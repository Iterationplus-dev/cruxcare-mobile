import { useQuery } from '@tanstack/vue-query';
import { therapistsApi } from '@/api/therapists.api';

/**
 * The client's therapist requests. Assignment is a staff workflow that
 * progresses server-side with no event the app can observe, so this refetches
 * on focus rather than leaving a stale status on screen after a push arrives.
 */
/** Shared so a screen that changes these can invalidate them by the same key. */
export const CARE_REQUESTS_KEY = ['care', 'requests'] as const;

export function useCareRequests() {
  return useQuery({
    queryKey: CARE_REQUESTS_KEY,
    queryFn: () => therapistsApi.listRequests(),
    refetchOnWindowFocus: true,
  });
}
