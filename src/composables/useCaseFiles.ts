import { computed, unref, type MaybeRef } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { caseFilesApi, healthProfileApi, type CaseFileListParams } from '@/api/case-files.api';

/**
 * The caller's case files. Filtering and searching are server-side, so the
 * query key carries them — a filter applied in the browser would only ever see
 * the page it happened to load.
 */
export function useCaseFiles(params: MaybeRef<CaseFileListParams> = {}) {
  return useQuery({
    queryKey: computed(() => ['case-files', unref(params)]),
    queryFn: () => caseFilesApi.list(unref(params)),
    // Keeps the previous rows on screen while a filter or search refetches,
    // instead of flashing an empty list between keystrokes.
    placeholderData: (previous) => previous,
  });
}

export function useCaseFile(id: string) {
  return useQuery({
    queryKey: ['case-files', id],
    queryFn: () => caseFilesApi.get(id),
  });
}

export function useHealthProfile() {
  return useQuery({
    queryKey: ['health-profile'],
    queryFn: () => healthProfileApi.get(),
    retry: false,
  });
}
