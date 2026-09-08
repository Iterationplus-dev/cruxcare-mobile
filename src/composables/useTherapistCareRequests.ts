import { useQuery } from '@tanstack/vue-query';
import { careQueueApi } from '@/api/care-queue.api';

/** Query key shared by the screen, the Today banner, and every invalidation
 * after a decision, so one accept updates all of them. */
export const THERAPIST_CARE_REQUESTS_KEY = ['therapist', 'care-requests'] as const;

/**
 * Requests waiting on this therapist. A client can send one at any moment and
 * nothing in the app observes that, so this refetches on focus rather than
 * showing a queue that silently went stale while the screen sat open.
 */
export function useTherapistCareRequests() {
  return useQuery({
    queryKey: THERAPIST_CARE_REQUESTS_KEY,
    queryFn: () => careQueueApi.list(),
    refetchOnWindowFocus: true,
  });
}
