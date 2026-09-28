import { computed, toValue, type MaybeRefOrGetter, unref, type MaybeRef } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { caseFilesApi, healthProfileApi, type CaseFileListParams } from '@/api/case-files.api';
import { casesApi } from '@/api/cases.api';

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

/**
 * One client's health profile, read by their therapist.
 *
 * The client id is in the query key rather than only in the closure: without it
 * a therapist opening a second client's file is served the first one's profile
 * from cache, which is the one mistake this screen must not make.
 *
 * `enabled` keeps it from firing until the case file says access was granted —
 * an unasked read is a guaranteed 403, and 403s are not retried because no
 * amount of trying turns a refusal into a yes.
 */
export function useClientHealthProfile(clientId: MaybeRef<string>, enabled: MaybeRef<boolean>) {
  return useQuery({
    queryKey: computed(() => ['health-profile', 'client', unref(clientId)]),
    queryFn: () => healthProfileApi.forClient(unref(clientId)),
    enabled: computed(() => Boolean(unref(enabled) && unref(clientId))),
    retry: false,
  });
}

/**
 * What the client owes for a case. Keyed by the *case* id rather than the case
 * file's — the billing routes live under `/cases/{caseId}` and the two are
 * different id spaces.
 */
export function useCaseBill(caseId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => ['case-bill', toValue(caseId)]),
    queryFn: () => casesApi.bill(toValue(caseId)),
    enabled: computed(() => !!toValue(caseId)),
  });
}

/** The products on a case, safe for a client screen to read. */
export function useCaseRecommendations(caseId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => ['case-recommendations', toValue(caseId)]),
    queryFn: () => casesApi.recommendations(toValue(caseId)),
    enabled: computed(() => !!toValue(caseId)),
  });
}
