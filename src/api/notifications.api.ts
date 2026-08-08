import { apiClient } from './client';
import type { AppNotification } from '@/types/notifications';

export const notificationsApi = {
  async list(): Promise<AppNotification[]> {
    const { data } = await apiClient.get<AppNotification[]>('/notifications');
    return data;
  },

  async markRead(id: string): Promise<void> {
    await apiClient.patch(`/notifications/${id}`, { read: true });
  },
};
