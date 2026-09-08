import { apiClient } from './client';
import type { DeviceRegistration, NotificationPreferences } from '@/types/push';

export const devicesApi = {
  /**
   * Upsert by `installationId`, not by token: the same device re-registering
   * with a rotated FCM token must replace its row rather than add one, or the
   * user gets duplicate pushes and stale rows can never be revoked.
   */
  async register(payload: DeviceRegistration): Promise<void> {
    await apiClient.post('/devices/token', payload);
  },

  /** Called on sign-out so the next person on this handset gets nothing. */
  async unregister(installationId: string): Promise<void> {
    await apiClient.delete(`/devices/token/${encodeURIComponent(installationId)}`);
  },
};

export const notificationPreferencesApi = {
  async get(): Promise<NotificationPreferences> {
    const { data } = await apiClient.get<NotificationPreferences>('/notifications/prefs');
    return data;
  },

  /**
   * Only optional categories and quiet hours are patchable. The server rejects
   * an attempt to switch off a required category rather than silently ignoring
   * it, so the UI can never imply a security alert was turned off.
   */
  async update(
    patch: Partial<Pick<NotificationPreferences, 'optional' | 'quietHours'>>,
  ): Promise<NotificationPreferences> {
    const { data } = await apiClient.patch<NotificationPreferences>('/notifications/prefs', patch);
    return data;
  },
};
