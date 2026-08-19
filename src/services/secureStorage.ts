import { Capacitor } from '@capacitor/core';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

/**
 * Wraps the platform secure storage plugin (Keychain on iOS, Keystore on
 * Android, localStorage-backed fallback on web) so the auth token is never
 * held in plain localStorage/sessionStorage directly (README "Secrets on
 * device").
 */
function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) return browserStorage()?.getItem(key) ?? null;

    try {
      const { value } = await SecureStoragePlugin.get({ key });
      return value;
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      browserStorage()?.setItem(key, value);
      return;
    }

    await SecureStoragePlugin.set({ key, value });
  },

  async remove(key: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      browserStorage()?.removeItem(key);
      return;
    }

    try {
      await SecureStoragePlugin.remove({ key });
    } catch {
      // Already absent — nothing to do.
    }
  },
};

export const SECURE_STORAGE_KEYS = {
  authToken: 'cc_auth_token',
  /**
   * Stable id for this app installation, used to revoke one device's push
   * registration without touching the user's other devices. Not a hardware
   * identifier — it is generated here and dies with the install.
   */
  pushInstallationId: 'cc_push_installation_id',
} as const;
