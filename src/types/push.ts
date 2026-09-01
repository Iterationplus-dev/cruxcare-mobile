import type { NotificationCategory } from './notifications';

export type DevicePlatform = 'android' | 'ios' | 'web';

/** Mirrors Capacitor's permission vocabulary, collapsed to what the API needs. */
export type PushPermissionState = 'granted' | 'denied' | 'prompt';

/**
 * One row per app installation. `installationId` — not the push token — is the
 * identity: FCM/APNs tokens rotate on their own, so keying on the token would
 * leave a trail of stale rows and make "sign out this device" impossible.
 *
 * The token is a delivery address, never a credential: possession of one must
 * not authenticate or authorise anything.
 */
export interface DeviceRegistration {
  installationId: string;
  /** FCM registration token on Android, APNs device token on iOS. */
  token: string;
  platform: DevicePlatform;
  /** What the OS currently reports, so the server can stop sending to a revoked device. */
  permission: PushPermissionState;
  appVersion: string;
}

/**
 * Matches `NotificationPreferenceService::OPTIONAL` on the server.
 *
 * `cases` was missing here, so the settings screen had no row for it and
 * nothing in the app could ever switch it off — a category the server has
 * always accepted, unreachable because the type did not name it.
 */
export type OptionalNotificationCategory =
  | 'appointments'
  | 'orders'
  | 'cases'
  | 'chat'
  | 'marketing';

export interface NotificationPreferences {
  /** Categories the user may switch off. */
  optional: Record<OptionalNotificationCategory, boolean>;
  /**
   * Security and money events. Server-listed and shown read-only — the product
   * rule is that these cannot be silently disabled.
   */
  required: { key: string; label: string }[];
  /** Null when the user has no quiet hours set. `HH:mm` in the device's timezone. */
  quietHours: {
    start: string;
    end: string;
    /** Time-sensitive reminders still break through when true. */
    allowTimeSensitive: boolean;
  } | null;
}

/**
 * The `data` block CruxCare sends on every push. FCM stringifies every data
 * value, so nothing here may be typed as a number or boolean on the wire —
 * `params` in particular arrives as a JSON *string*.
 */
export interface PushPayloadData {
  /** Ties the push to the row `GET /notifications` returns, so a tap can mark it read. */
  notificationId?: string;
  category?: NotificationCategory;
  /** A Vue Router *name*, so the app owns its own URL structure. */
  route?: string;
  /** JSON-encoded route params, e.g. `{"id":"apt_123"}`. */
  params?: string;
}
