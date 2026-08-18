import { apiClient } from './client';
import type { CursorPage } from '@/types/api';
import type { TherapistSummary } from '@/types/care';

export interface CareRequestResult {
  id: string;
  reference: string;
  status: string;
  reason: string;
  /** Present when the request named a therapist, who has been notified. */
  therapistId?: string | null;
  createdAt: string;
}

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
   */
  async requestAssignment(reason: string, therapistId?: string): Promise<CareRequestResult> {
    const { data } = await apiClient.post<CareRequestResult>('/care/requests', {
      reason,
      ...(therapistId ? { therapistId } : {}),
    });
    return data;
  },
};
