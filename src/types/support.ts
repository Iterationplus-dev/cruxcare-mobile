/** The categories the admin console offers. Sending anything else files a
 *  ticket into a filter nobody has, which is the same as not filing it. */
export const supportCategories = ['General Enquiries', 'Bills', 'Technical'] as const;

export type SupportTicketCategory = (typeof supportCategories)[number];

/** Statuses staff move a ticket through. Open-ended for the same reason ledger
 *  types are: an unknown server value renders neutrally rather than breaking. */
// eslint-disable-next-line @typescript-eslint/ban-types
export type SupportTicketStatus = 'Open' | 'Pending' | 'Solved' | 'Closed' | (string & {});

export interface SupportTicket {
  id: string;
  /** What a person quotes back to support. */
  reference: string;
  subject: string;
  message: string;
  category: string;
  status: SupportTicketStatus;
  /** Staff's answer, or null when nobody has replied. Never an empty string
   *  standing in for one — an unanswered ticket must read as unanswered. */
  reply: string | null;
  createdAt: string;
  updatedAt: string;
}
