import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

/**
 * Wraps the platform secure storage plugin (Keychain on iOS, Keystore on
 * Android, localStorage-backed fallback on web) so the auth token is never
 * held in plain localStorage/sessionStorage directly (README "Secrets on
 * device").
 */
export const secureStorage = {
  async get(key: string): Promise<string | null> {
    try {
      const { value } = await SecureStoragePlugin.get({ key });
      return value;
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    await SecureStoragePlugin.set({ key, value });
  },

  async remove(key: string): Promise<void> {
    try {
      await SecureStoragePlugin.remove({ key });
    } catch {
      // Already absent — nothing to do.
    }
  },
};

export const SECURE_STORAGE_KEYS = {
  authToken: 'cc_auth_token',
} as const;
