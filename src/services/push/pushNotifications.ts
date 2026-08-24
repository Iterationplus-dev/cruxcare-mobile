import { ref, type Ref } from 'vue';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import {
  PushNotifications,
  type ActionPerformed,
  type PushNotificationSchema,
  type Token,
} from '@capacitor/push-notifications';
import type { Router } from 'vue-router';
import { devicesApi } from '@/api/devices.api';
import { secureStorage, SECURE_STORAGE_KEYS } from '@/services/secureStorage';
import type { DevicePlatform, PushPayloadData, PushPermissionState } from '@/types/push';

/**
 * Push notifications, end to end.
 *
 * Order of operations matters and is easy to get wrong:
 *   1. attach listeners *before* registering, or the `registration` event that
 *      carries the token can fire before anything is listening;
 *   2. ask for permission explicitly — `register()` does not prompt, and on
 *      Android 13+ (this app targets 36) an unprompted app is silently denied;
 *   3. create the notification channel, otherwise Android files every push
 *      under the "Miscellaneous" fallback channel;
 *   4. only then register and upload the token.
 *
 * The token is a delivery address, not a credential, and is only uploaded
 * while a session is active — see `docs/PUSH_NOTIFICATIONS_CONTRACT.md`.
 */

/** Must match the `android_channel_id` the backend sets on its FCM messages. */
export const DEFAULT_CHANNEL_ID = 'cruxcare-default';

export interface PushDeps {
  router: Router;
  /**
   * Lets a foreground push refresh the inbox, and whatever else it reports
   * having changed, without a reload. The payload is passed through so the
   * caller can scope that refresh by `category`.
   */
  onNotificationReceived?: (data: PushPayloadData) => void;
}

export type PushEnableResult =
  | { status: 'registered'; token: string }
  | { status: 'denied' }
  | { status: 'unsupported' }
  | { status: 'error'; message: string };

let deps: PushDeps | null = null;
let listeners: PluginListenerHandle[] = [];
let currentToken: string | null = null;
let installationId: string | null = null;
/** Set once a session is active, so a token arriving before login is not dropped. */
let uploadEnabled = false;
/** Resolved by the `registration` event, which fires well after `register()` returns. */
let pendingRegistration: { resolve: (token: string) => void; reject: (error: Error) => void } | null =
  null;

/**
 * What the OS last told us. Screens read this so they never present per-category
 * preferences as effective while the system is blocking delivery outright.
 * `unknown` means it has not been checked on this platform yet.
 */
export const pushPermissionState: Ref<PushPermissionState | 'unknown'> = ref('unknown');

function isSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('PushNotifications');
}

function platform(): DevicePlatform {
  const name = Capacitor.getPlatform();
  return name === 'android' || name === 'ios' ? name : 'web';
}

function toPermissionState(receive: string): PushPermissionState {
  if (receive === 'granted') return 'granted';
  if (receive === 'denied') return 'denied';
  return 'prompt';
}

/**
 * A stable id for this installation, kept in secure storage. Deliberately not
 * a hardware identifier: it must not survive a reinstall or be correlatable
 * across apps, it only has to outlive a token rotation.
 */
async function getInstallationId(): Promise<string> {
  if (installationId) return installationId;

  const stored = await secureStorage.get(SECURE_STORAGE_KEYS.pushInstallationId);
  if (stored) {
    installationId = stored;
    return stored;
  }

  const created = crypto.randomUUID();
  await secureStorage.set(SECURE_STORAGE_KEYS.pushInstallationId, created);
  installationId = created;
  return created;
}

async function appVersion(): Promise<string> {
  try {
    const info = await CapacitorApp.getInfo();
    return `${info.version} (${info.build})`;
  } catch {
    // Not available on web, and never worth failing a registration over.
    return 'unknown';
  }
}

async function uploadToken(token: string): Promise<void> {
  if (!uploadEnabled) return;

  const permission = await refreshPushPermission();
  await devicesApi.register({
    installationId: await getInstallationId(),
    token,
    platform: platform(),
    permission,
    appVersion: await appVersion(),
  });
}

/**
 * Waits for the token the `registration` event carries. Bounded, because on a
 * device with no Play Services the event never arrives at all and the caller
 * would otherwise hang forever.
 */
function awaitRegistration(timeoutMs = 15_000): Promise<string> {
  if (currentToken) return Promise.resolve(currentToken);

  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRegistration = null;
      reject(new Error('Timed out waiting for a push registration token.'));
    }, timeoutMs);

    pendingRegistration = {
      resolve: (token) => {
        clearTimeout(timer);
        resolve(token);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    };
  });
}

/** Re-reads the OS permission and publishes it to `pushPermissionState`. */
export async function refreshPushPermission(): Promise<PushPermissionState> {
  if (!isSupported()) {
    pushPermissionState.value = 'unknown';
    return 'prompt';
  }

  const { receive } = await PushNotifications.checkPermissions();
  const state = toPermissionState(receive);
  pushPermissionState.value = state;
  return state;
}

/**
 * The backend addresses screens by route *name* so the app keeps ownership of
 * its URL structure. An unknown name falls back to the inbox rather than
 * throwing the user into a blank screen.
 */
async function openFromPayload(data: PushPayloadData): Promise<void> {
  if (!deps) return;

  const target = data.route?.trim();
  if (!target || !deps.router.hasRoute(target)) {
    await deps.router.push({ name: 'notifications' });
    return;
  }

  let params: Record<string, string> = {};
  if (data.params) {
    try {
      // FCM stringifies every data value, so params arrive as JSON text.
      const parsed: unknown = JSON.parse(data.params);
      if (parsed && typeof parsed === 'object') params = parsed as Record<string, string>;
    } catch {
      // A malformed payload should still open the screen, just without params.
    }
  }

  await deps.router.push({ name: target, params });
}

/** Attach once at app start. Safe to call repeatedly; listeners are not duplicated. */
export async function initPushNotifications(dependencies: PushDeps): Promise<void> {
  deps = dependencies;
  if (!isSupported() || listeners.length) return;

  listeners = await Promise.all([
    PushNotifications.addListener('registration', (token: Token) => {
      currentToken = token.value;
      pendingRegistration?.resolve(token.value);
      pendingRegistration = null;
      // FCM rotates tokens on its own schedule; every rotation has to reach
      // the server or delivery silently stops.
      void uploadToken(token.value).catch((error) => {
        console.error('Could not register this device for push notifications.', error);
      });
    }),

    PushNotifications.addListener('registrationError', (error) => {
      // Overwhelmingly this is a missing/incorrect google-services.json.
      console.error('Push registration failed.', error);
      pendingRegistration?.reject(new Error(String((error as { error?: string })?.error ?? error)));
      pendingRegistration = null;
    }),

    PushNotifications.addListener('pushNotificationReceived', (message: PushNotificationSchema) => {
      deps?.onNotificationReceived?.((message.data ?? {}) as PushPayloadData);
    }),

    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      void openFromPayload((action.notification.data ?? {}) as PushPayloadData);
    }),
  ]);

  // Android files pushes without an explicit channel under "Miscellaneous",
  // where the user cannot tune them and importance defaults low.
  if (Capacitor.getPlatform() === 'android') {
    try {
      await PushNotifications.createChannel({
        id: DEFAULT_CHANNEL_ID,
        name: 'CruxCare alerts',
        description: 'Appointments, orders, wallet activity and messages.',
        importance: 4,
        visibility: 0,
        vibration: true,
      });
    } catch (error) {
      console.error('Could not create the default notification channel.', error);
    }
  }
}

/**
 * Requests permission and registers. Call once a session exists — a token
 * uploaded without one cannot be attached to a user.
 */
export async function enablePushNotifications(): Promise<PushEnableResult> {
  if (!isSupported()) return { status: 'unsupported' };

  uploadEnabled = true;

  try {
    let { receive } = await PushNotifications.checkPermissions();
    // `register()` never prompts, so an un-prompted app is simply never asked.
    if (receive === 'prompt' || receive === 'prompt-with-rationale') {
      ({ receive } = await PushNotifications.requestPermissions());
    }

    pushPermissionState.value = toPermissionState(receive);
    if (receive !== 'granted') return { status: 'denied' };

    // A token already in hand means the listener fired before login; upload it
    // now rather than waiting for a rotation that may be days away.
    if (currentToken) {
      await uploadToken(currentToken);
      return { status: 'registered', token: currentToken };
    }

    await PushNotifications.register();
    // `register()` resolves as soon as the native call is made — the token
    // arrives later on the `registration` event, so reading it here would
    // always find nothing.
    return { status: 'registered', token: await awaitRegistration() };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Push registration failed.',
    };
  }
}

/**
 * Sign-out path. Revoking server-side first is what actually stops delivery —
 * dropping the local token alone would leave this handset receiving the
 * previous user's notifications.
 */
export async function disablePushNotifications(): Promise<void> {
  uploadEnabled = false;
  if (!isSupported()) return;

  try {
    await devicesApi.unregister(await getInstallationId());
  } catch (error) {
    // A failed revoke must not block sign-out; the server also drops tokens
    // that FCM reports as unregistered.
    console.error('Could not revoke this device server-side.', error);
  }

  try {
    await PushNotifications.unregister();
    await PushNotifications.removeAllDeliveredNotifications();
  } catch (error) {
    console.error('Could not unregister from push notifications.', error);
  }

  currentToken = null;
}

/** Test seam and diagnostics. Null until a token has been received. */
export function currentPushToken(): string | null {
  return currentToken;
}

export async function teardownPushNotifications(): Promise<void> {
  await Promise.all(listeners.map((listener) => listener.remove()));
  listeners = [];
  deps = null;
}
