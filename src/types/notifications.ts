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
  /**
   * Promotional. A wire category in its own right, not a preference key that
   * arrives as something else — it was missing here for the same reason
   * `cases` was, and would have fallen through the inbox the same way.
   *
   * `security` is deliberately absent: it travels as `system` while being
   * gated by its own unmutable preference, so it never appears on the wire.
   * Anything unrecognised degrades to `system` server-side.
   */
  | 'marketing'
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
