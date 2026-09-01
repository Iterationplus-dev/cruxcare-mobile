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
