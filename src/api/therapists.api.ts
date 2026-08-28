import { apiClient } from './client';
import type { CursorPage } from '@/types/api';
import type { CareRequest, TherapistSummary } from '@/types/care';

export const therapistsApi = {
  async list(cursor?: string): Promise<CursorPage<TherapistSummary>> {
    const { data } = await apiClient.get<CursorPage<TherapistSummary>>('/therapists', {
      params: { cursor },
    });
    return data;
  },

  async get(id: string): Promise<TherapistSummary> {
    const { data } = await apiClient.get<TherapistSummary>(`/therapists/${id}`);
    return data;
  },

  /**
   * The signed-in therapist's own public profile — the same record clients
   * read. Resolved from the session, never from a therapist id supplied by the
   * client, so one therapist cannot read or edit another's profile.
   */
  async myProfile(): Promise<TherapistSummary> {
    const { data } = await apiClient.get<TherapistSummary>('/me/therapist/profile');
    return data;
  },

  /**
   * `specialties` is required, not optional: the server treats an omitted key
   * as a `422` rather than a clear, on the grounds that forgetting it is far
   * more likely a bug than an intention to wipe a therapist's profile. Sending
   * `[]` is how the list is cleared.
   */
  async updateMyProfile(patch: { specialties: string[] }): Promise<TherapistSummary> {
    const { data } = await apiClient.patch<TherapistSummary>('/me/therapist/profile', patch);
    return data;
  },

  /**
   * `therapistId` asks for that specific therapist, who is attached to the
   * case and notified. Omitted, it stays an open request for staff to match.
   *
   * Returns the created request in full so the tracking screen can show it
   * without a second round trip.
   */
  async requestAssignment(reason: string, therapistId?: string): Promise<CareRequest> {
    const { data } = await apiClient.post<CareRequest>('/care/requests', {
      reason,
      ...(therapistId ? { therapistId } : {}),
    });
    return data;
  },

  /** The client's own requests, newest first, so they can follow progress. */
  async listRequests(cursor?: string): Promise<CursorPage<CareRequest>> {
    const { data } = await apiClient.get<CursorPage<CareRequest>>('/care/requests', {
      params: { cursor },
    });
    return data;
  },

  async getRequest(id: string): Promise<CareRequest> {
    const { data } = await apiClient.get<CareRequest>(`/care/requests/${id}`);
    return data;
  },

  /** Withdraws a request that has not been accepted yet. */
  async cancelRequest(id: string): Promise<CareRequest> {
    const { data } = await apiClient.post<CareRequest>(`/care/requests/${id}/cancel`);
    return data;
  },
};
