import { apiClient } from './client';
import type { CursorPage } from '@/types/api';
import type {
  CaseFile,
  ClientRelationshipState,
  ClientStateCounts,
  HealthProfile,
} from '@/types/care';

export interface CaseFileListParams {
  cursor?: string;
  state?: ClientRelationshipState;
  q?: string;
}

export type CaseFilePage = CursorPage<CaseFile> & { meta: { counts?: ClientStateCounts } };

export const caseFilesApi = {
  /**
   * `state` and `q` filter server-side, and the counts in `meta` are computed
   * over every accessible row rather than the page — a count derived from one
   * cursor page is a false statement the client cannot correct.
   */
  async list(params: CaseFileListParams = {}): Promise<CaseFilePage> {
    const { data } = await apiClient.get<CaseFilePage>('/case-files', {
      params: {
        cursor: params.cursor,
        state: params.state,
        // Omitted rather than sent empty, so a cleared search is not a filter.
        q: params.q?.trim() || undefined,
      },
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

  /**
   * Puts a product on the case. It lands `pending` and costs the client
   * nothing until they accept it.
   *
   * Re-recommending a product that still has a pending line updates that line
   * rather than adding a second. Once the client has answered, a further
   * recommendation adds a new line instead — a line they accepted is a
   * decision, possibly already paid against, and is never rewritten under them.
   */
  async addRecommendation(
    id: string,
    productId: string,
    note: string | null,
    quantity = 1,
  ): Promise<CaseFile> {
    const { data } = await apiClient.patch<CaseFile>(`/case-files/${id}`, {
      recommendation: { productId, note, quantity },
    });
    return data;
  },
};

export const healthProfileApi = {
  async get(): Promise<HealthProfile> {
    const { data } = await apiClient.get<HealthProfile>('/health-profile');
    return data;
  },

  /**
   * The read a grant unlocks, for an assigned therapist. Every refusal names
   * itself — `access_not_requested`, `access_pending` and `access_revoked` come
   * back as 403s, and only a lapsed plan or a client this therapist does not
   * treat answers 404 (backend note §15.2). `healthProfileAccessView` turns
   * those into what the panel shows; nothing here should switch on the status
   * code alone.
   */
  async forClient(clientId: string): Promise<HealthProfile> {
    const { data } = await apiClient.get<HealthProfile>(`/clients/${clientId}/health-profile`);
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
