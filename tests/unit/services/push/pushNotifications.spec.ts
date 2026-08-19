import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The push service is almost entirely native-plugin orchestration, and the
 * failure modes that matter are ordering ones: a token that arrives before a
 * session, a rotation that never reaches the server, a sign-out that leaves a
 * handset subscribed. Those are what these tests pin down.
 */

type Listener = (payload: unknown) => void;
const listeners = new Map<string, Listener>();

let platformName = 'android';
const checkPermissions = vi.fn();
const requestPermissions = vi.fn();
const register = vi.fn();
const unregister = vi.fn().mockResolvedValue(undefined);
const removeAllDelivered = vi.fn().mockResolvedValue(undefined);
const createChannel = vi.fn().mockResolvedValue(undefined);

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => platformName !== 'web',
    isPluginAvailable: () => true,
    getPlatform: () => platformName,
  },
}));

vi.mock('@capacitor/app', () => ({
  App: { getInfo: vi.fn().mockResolvedValue({ version: '1.2.0', build: '42' }) },
}));

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    addListener: (event: string, handler: Listener) => {
      listeners.set(event, handler);
      return Promise.resolve({ remove: () => Promise.resolve() });
    },
    checkPermissions: () => checkPermissions(),
    requestPermissions: () => requestPermissions(),
    register: () => register(),
    unregister: () => unregister(),
    removeAllDeliveredNotifications: () => removeAllDelivered(),
    createChannel: (channel: unknown) => createChannel(channel),
  },
}));

const registerDevice = vi.fn().mockResolvedValue(undefined);
const unregisterDevice = vi.fn().mockResolvedValue(undefined);
vi.mock('@/api/devices.api', () => ({
  devicesApi: {
    register: (payload: unknown) => registerDevice(payload),
    unregister: (id: string) => unregisterDevice(id),
  },
  notificationPreferencesApi: { get: vi.fn(), update: vi.fn() },
}));

const store = new Map<string, string>();
vi.mock('@/services/secureStorage', () => ({
  secureStorage: {
    get: (key: string) => Promise.resolve(store.get(key) ?? null),
    set: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
    remove: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
  },
  SECURE_STORAGE_KEYS: { authToken: 'cc_auth_token', pushInstallationId: 'cc_push_installation_id' },
}));

const push = await import('@/services/push/pushNotifications');

const pushedRoutes: unknown[] = [];
const router = {
  hasRoute: (name: string) => ['notifications', 'order-detail'].includes(name),
  push: (target: unknown) => {
    pushedRoutes.push(target);
    return Promise.resolve();
  },
} as never;

/** Drives the plugin event the real SDK would emit. */
function emit(event: string, payload: unknown) {
  listeners.get(event)?.(payload);
}

async function flush() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(async () => {
  await push.teardownPushNotifications();
  listeners.clear();
  pushedRoutes.length = 0;
  store.clear();
  platformName = 'android';
  registerDevice.mockClear();
  unregisterDevice.mockClear();
  register.mockReset().mockResolvedValue(undefined);
  requestPermissions.mockReset();
  checkPermissions.mockReset().mockResolvedValue({ receive: 'granted' });
  createChannel.mockClear();
  await push.disablePushNotifications();
  unregisterDevice.mockClear();
});

describe('initPushNotifications', () => {
  it('creates an explicit Android channel so pushes are not filed under Miscellaneous', async () => {
    await push.initPushNotifications({ router });

    expect(createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: push.DEFAULT_CHANNEL_ID, importance: 4 }),
    );
  });

  it('does nothing on the web, where there is no native registration to make', async () => {
    platformName = 'web';

    await push.initPushNotifications({ router });

    expect(createChannel).not.toHaveBeenCalled();
    await expect(push.enablePushNotifications()).resolves.toEqual({ status: 'unsupported' });
  });
});

describe('token handling', () => {
  it('does not upload a token that arrives before a session exists', async () => {
    await push.initPushNotifications({ router });

    emit('registration', { value: 'fcm-early' });
    await flush();

    expect(registerDevice).not.toHaveBeenCalled();
  });

  it('uploads a token already in hand once the session starts', async () => {
    await push.initPushNotifications({ router });
    emit('registration', { value: 'fcm-early' });
    await flush();

    const result = await push.enablePushNotifications();

    expect(result).toEqual({ status: 'registered', token: 'fcm-early' });
    expect(registerDevice).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'fcm-early', platform: 'android', permission: 'granted' }),
    );
    // The token was already available, so there is nothing to re-register for.
    expect(register).not.toHaveBeenCalled();
  });

  it('uploads a rotated token without waiting for another sign-in', async () => {
    await push.initPushNotifications({ router });
    emit('registration', { value: 'fcm-first' });
    await push.enablePushNotifications();
    registerDevice.mockClear();

    emit('registration', { value: 'fcm-rotated' });
    await flush();

    expect(registerDevice).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'fcm-rotated' }),
    );
  });

  it('keeps one stable installation id across token rotations', async () => {
    await push.initPushNotifications({ router });
    emit('registration', { value: 'fcm-first' });
    await push.enablePushNotifications();
    emit('registration', { value: 'fcm-rotated' });
    await flush();

    const ids = registerDevice.mock.calls.map(([payload]) => (payload as { installationId: string }).installationId);

    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBeTruthy();
  });

  it('asks for permission, since register() never prompts on its own', async () => {
    checkPermissions.mockResolvedValue({ receive: 'prompt' });
    requestPermissions.mockResolvedValue({ receive: 'granted' });
    // The real plugin resolves register() immediately and delivers the token
    // later on the `registration` event.
    register.mockImplementation(async () => {
      setTimeout(() => emit('registration', { value: 'fcm-late' }), 0);
    });
    await push.initPushNotifications({ router });

    const result = await push.enablePushNotifications();

    expect(requestPermissions).toHaveBeenCalled();
    expect(register).toHaveBeenCalled();
    // Reading the token straight after register() would always find nothing.
    expect(result).toEqual({ status: 'registered', token: 'fcm-late' });
  });

  it('surfaces a registration error rather than waiting for a token that never comes', async () => {
    register.mockImplementation(async () => {
      // What a missing google-services.json produces on a real device.
      setTimeout(() => emit('registrationError', { error: 'MISSING_INSTANCEID_SERVICE' }), 0);
    });
    await push.initPushNotifications({ router });

    const result = await push.enablePushNotifications();

    expect(result).toMatchObject({ status: 'error' });
    expect(registerDevice).not.toHaveBeenCalled();
  });

  it('reports denial instead of registering', async () => {
    checkPermissions.mockResolvedValue({ receive: 'prompt' });
    requestPermissions.mockResolvedValue({ receive: 'denied' });
    await push.initPushNotifications({ router });

    await expect(push.enablePushNotifications()).resolves.toEqual({ status: 'denied' });
    expect(register).not.toHaveBeenCalled();
    expect(push.pushPermissionState.value).toBe('denied');
  });
});

describe('disablePushNotifications', () => {
  it('revokes the device server-side so the next user gets nothing', async () => {
    await push.initPushNotifications({ router });
    emit('registration', { value: 'fcm-token' });
    await push.enablePushNotifications();
    const installationId = (registerDevice.mock.calls[0][0] as { installationId: string }).installationId;

    await push.disablePushNotifications();

    expect(unregisterDevice).toHaveBeenCalledWith(installationId);
    expect(unregister).toHaveBeenCalled();
    expect(push.currentPushToken()).toBeNull();
  });

  it('still unregisters locally when the server call fails', async () => {
    unregisterDevice.mockRejectedValueOnce(new Error('offline'));
    await push.initPushNotifications({ router });
    emit('registration', { value: 'fcm-token' });
    await push.enablePushNotifications();
    unregister.mockClear();

    await expect(push.disablePushNotifications()).resolves.toBeUndefined();
    expect(unregister).toHaveBeenCalled();
  });

  it('stops uploading tokens after sign-out', async () => {
    await push.initPushNotifications({ router });
    emit('registration', { value: 'fcm-token' });
    await push.enablePushNotifications();
    await push.disablePushNotifications();
    registerDevice.mockClear();

    emit('registration', { value: 'fcm-after-logout' });
    await flush();

    expect(registerDevice).not.toHaveBeenCalled();
  });
});

describe('notification taps', () => {
  it('opens the named route with JSON-decoded params', async () => {
    await push.initPushNotifications({ router });

    emit('pushNotificationActionPerformed', {
      actionId: 'tap',
      notification: { id: '1', data: { route: 'order-detail', params: '{"id":"ord_7"}' } },
    });
    await flush();

    expect(pushedRoutes).toEqual([{ name: 'order-detail', params: { id: 'ord_7' } }]);
  });

  it('falls back to the inbox for a route this build does not have', async () => {
    await push.initPushNotifications({ router });

    emit('pushNotificationActionPerformed', {
      actionId: 'tap',
      notification: { id: '1', data: { route: 'route-from-a-newer-app' } },
    });
    await flush();

    expect(pushedRoutes).toEqual([{ name: 'notifications' }]);
  });

  it('still opens the screen when params are malformed', async () => {
    await push.initPushNotifications({ router });

    emit('pushNotificationActionPerformed', {
      actionId: 'tap',
      notification: { id: '1', data: { route: 'order-detail', params: 'not-json' } },
    });
    await flush();

    expect(pushedRoutes).toEqual([{ name: 'order-detail', params: {} }]);
  });

  it('opens the inbox when the payload carries no route at all', async () => {
    await push.initPushNotifications({ router });

    emit('pushNotificationActionPerformed', { actionId: 'tap', notification: { id: '1', data: {} } });
    await flush();

    expect(pushedRoutes).toEqual([{ name: 'notifications' }]);
  });
});

describe('foreground delivery', () => {
  it('tells the app to refresh the inbox', async () => {
    const onNotificationReceived = vi.fn();
    await push.initPushNotifications({ router, onNotificationReceived });

    emit('pushNotificationReceived', { id: '1', data: {} });

    expect(onNotificationReceived).toHaveBeenCalled();
  });
});
