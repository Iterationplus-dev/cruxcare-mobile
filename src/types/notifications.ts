export type NotificationCategory =
  | 'appointments'
  /**
   * The course of treatment: a plan proposed, paid for, started, or a case
   * closed. Distinct from `appointments`, which is one session at a time —
   * and already the vocabulary of the push preference switches, so the inbox
   * had to learn it too rather than drop these rows out of every filter.
   */
  | 'cases'
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
