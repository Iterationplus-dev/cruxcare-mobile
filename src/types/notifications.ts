export type NotificationCategory =
  | 'appointments'
  | 'orders'
  | 'wallet'
  | 'chat'
  | 'system';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  read: boolean;
  actionLabel: string | null;
  actionRoute: string | null;
  createdAt: string;
}
