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
