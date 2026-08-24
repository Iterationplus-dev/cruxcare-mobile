import { useQuery } from '@tanstack/vue-query';
import { therapistsApi } from '@/api/therapists.api';

/**
 * The client's therapist requests. Assignment is a staff workflow that
 * progresses server-side with no event the app can observe, so this refetches
 * on focus rather than leaving a stale status on screen after a push arrives.
 */
export function useCareRequests() {
  return useQuery({
    queryKey: ['care', 'requests'],
    queryFn: () => therapistsApi.listRequests(),
    refetchOnWindowFocus: true,
  });
}
