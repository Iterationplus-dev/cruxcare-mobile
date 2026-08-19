import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query';
import { notificationsApi } from '@/api/notifications.api';
import { notificationPreferencesApi } from '@/api/devices.api';
import type { NotificationPreferences } from '@/types/push';

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationPreferencesApi.get(),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Pick<NotificationPreferences, 'optional' | 'quietHours'>>) =>
      notificationPreferencesApi.update(patch),
    /**
     * The server's answer replaces the cache rather than invalidating it: it
     * is the authority on what a toggle actually did, and a required category
     * it refused to change must not appear flipped even briefly.
     */
    onSuccess: (preferences) => {
      queryClient.setQueryData(['notification-preferences'], preferences);
    },
  });
}
