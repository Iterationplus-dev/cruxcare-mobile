import { NativeBiometric } from 'capacitor-native-biometric';
import { secureStorage } from './secureStorage';

const BIOMETRIC_ENABLED_KEY = 'cc_biometric_enabled';

export const biometric = {
  async isAvailable(): Promise<boolean> {
    try {
      const result = await NativeBiometric.isAvailable();
      return result.isAvailable;
    } catch {
      return false;
    }
  },

  /** Whether this device has previously opted in via CA5/A7 (password stays the fallback either way). */
  async isEnabledOnDevice(): Promise<boolean> {
    return (await secureStorage.get(BIOMETRIC_ENABLED_KEY)) === 'true';
  },

  async markEnabledOnDevice(): Promise<void> {
    await secureStorage.set(BIOMETRIC_ENABLED_KEY, 'true');
  },

  async verify(reason: string): Promise<boolean> {
    try {
      await NativeBiometric.verifyIdentity({ reason, useFallback: true });
      return true;
    } catch {
      return false;
    }
  },
};
