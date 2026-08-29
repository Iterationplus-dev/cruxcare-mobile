import { apiClient } from './client';
import type { CursorPage } from '@/types/api';
import type { CaseFile, HealthProfile } from '@/types/care';

export const caseFilesApi = {
  async list(cursor?: string): Promise<CursorPage<CaseFile>> {
    const { data } = await apiClient.get<CursorPage<CaseFile>>('/case-files', {
      params: { cursor },
    });
    return data;
  },

  async get(id: string): Promise<CaseFile> {
    const { data } = await apiClient.get<CaseFile>(`/case-files/${id}`);
    return data;
  },

  /**
   * Record or correct the diagnosis. There is no clearing it: the server
   * refuses null and blank with `diagnosis_not_clearable`, because a file that
   * was never diagnosed and one whose diagnosis was deleted would otherwise
   * read the same. Every change is recorded with what it replaced.
   */
  async setDiagnosis(id: string, diagnosis: string): Promise<CaseFile> {
    const { data } = await apiClient.patch<CaseFile>(`/case-files/${id}`, { diagnosis });
    return data;
  },

  async addNote(id: string, body: string, draft: boolean): Promise<CaseFile> {
    const { data } = await apiClient.patch<CaseFile>(`/case-files/${id}`, {
      note: { body, draft },
    });
    return data;
  },

  async addRecommendation(id: string, productId: string, note: string | null): Promise<CaseFile> {
    const { data } = await apiClient.patch<CaseFile>(`/case-files/${id}`, {
      recommendation: { productId, note },
    });
    return data;
  },
};

export const healthProfileApi = {
  async get(): Promise<HealthProfile> {
    const { data } = await apiClient.get<HealthProfile>('/health-profile');
    return data;
  },

  async update(
    sections: HealthProfile['sections'],
    consentVersion: string,
  ): Promise<HealthProfile> {
    const { data } = await apiClient.put<HealthProfile>('/health-profile', {
      sections,
      consentVersion,
    });
    return data;
  },
};
