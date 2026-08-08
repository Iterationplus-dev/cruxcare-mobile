import { useQuery } from '@tanstack/vue-query';
import { caseFilesApi, healthProfileApi } from '@/api/case-files.api';

export function useCaseFiles() {
  return useQuery({
    queryKey: ['case-files'],
    queryFn: () => caseFilesApi.list(),
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
