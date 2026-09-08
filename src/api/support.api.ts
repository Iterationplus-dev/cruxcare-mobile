import { apiClient } from './client';
import type { CursorPage } from '@/types/api';
import type { SupportTicket, SupportTicketCategory } from '@/types/support';

export interface SupportMessagePayload {
  message: string;
  subject?: string;
  category?: SupportTicketCategory;
}

export const supportApi = {
  /** The caller's own tickets, newest first. Scoped server-side to the session:
   *  a support ticket routinely carries the details of someone's account. */
  async list(cursor?: string): Promise<CursorPage<SupportTicket>> {
    const { data } = await apiClient.get<CursorPage<SupportTicket>>('/support/tickets', {
      params: { cursor },
    });
    return data;
  },

  /**
   * Raise a ticket. Returns it in full, so the screen can show the reference
   * immediately rather than telling someone their message was "queued" and
   * leaving them nothing to quote.
   */
  async send(payload: SupportMessagePayload): Promise<SupportTicket> {
    const { data } = await apiClient.post<SupportTicket>('/support/tickets', payload);
    return data;
  },
};
