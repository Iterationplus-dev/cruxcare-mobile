import { apiClient } from './client';
import type { CursorPage } from '@/types/api';
import type { TherapistCareRequest } from '@/types/care';

/**
 * The therapist's side of a care request. This is deliberately not part of
 * `therapistsApi`, which is the client-facing "find me a therapist" surface —
 * these routes are scoped to the caller *as* the named therapist, so mixing
 * them into the same object would blur which role each call belongs to.
 *
 * `GET /care/requests` cannot serve this: it is scoped to the caller's own
 * requests as a client, so a therapist calling it gets the requests they sent,
 * never the ones sent to them.
 */
export const careQueueApi = {
  /**
   * Requests naming the caller as therapist, newest first. Server-scoped —
   * the app never passes a therapist id, so there is nothing to tamper with.
   */
  async list(cursor?: string): Promise<CursorPage<TherapistCareRequest>> {
    const { data } = await apiClient.get<CursorPage<TherapistCareRequest>>(
      '/therapist/care-requests',
      { params: { cursor } },
    );
    return data;
  },

  /** Takes the case. Returns the updated request so the queue re-renders from
   * the server's status rather than an assumed one. */
  async accept(id: string): Promise<TherapistCareRequest> {
    const { data } = await apiClient.post<TherapistCareRequest>(
      `/therapist/care-requests/${id}/accept`,
    );
    return data;
  },

  /** Passes on the case; staff may re-match the client to someone else. */
  async decline(id: string): Promise<TherapistCareRequest> {
    const { data } = await apiClient.post<TherapistCareRequest>(
      `/therapist/care-requests/${id}/decline`,
    );
    return data;
  },
};
