import { apiClient } from './client';
import type { CursorPage } from '@/types/api';
import type { TherapistSummary } from '@/types/care';

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

  async requestAssignment(reason: string) {
    await apiClient.post('/care/requests', { reason });
  },
};
