import { apiClient } from './client';
import type { CursorPage } from '@/types/api';
import type { HealthProfileAccess } from '@/types/care';

/**
 * Who has asked to read the signed-in client's health profile, and what they
 * were told.
 *
 * The server built this when it chose reading 2 — acceptance permits asking,
 * the client decides. Until the app consumed it a therapist could ask and the
 * client had no way to see the question, let alone answer it.
 */
export const healthAccessApi = {
  /**
   * The therapist asks. The client id is in the path, not the body — the server
   * shipped it that way before this client existed (backend note §15.3).
   *
   * Re-asking after a refusal is allowed and reopens the same row rather than
   * raising a second one, so there is no cooldown to display and no permanent
   * refusal to design for: the care relationship is the whole gate, and a
   * therapist the client has left cannot ask at all.
   */
  async request(clientId: string, reason?: string): Promise<HealthProfileAccess> {
    const trimmed = reason?.trim();
    const { data } = await apiClient.post<HealthProfileAccess>(
      `/clients/${clientId}/health-profile/access`,
      // Omitted rather than sent empty: a blank reason is not a reason given.
      trimmed ? { reason: trimmed } : {},
    );
    return data;
  },

  async list(): Promise<HealthProfileAccess[]> {
    const { data } = await apiClient.get<CursorPage<HealthProfileAccess>>('/health-profile/access');
    return data.data;
  },

  async grant(id: string): Promise<HealthProfileAccess> {
    const { data } = await apiClient.post<HealthProfileAccess>(
      `/health-profile/access/${id}/grant`,
    );
    return data;
  },

  /** Answers a pending question with "no" and withdraws a grant already given.
   *  To the client those are one action, so the server made them one route. */
  async revoke(id: string): Promise<HealthProfileAccess> {
    const { data } = await apiClient.post<HealthProfileAccess>(
      `/health-profile/access/${id}/revoke`,
    );
    return data;
  },
};
