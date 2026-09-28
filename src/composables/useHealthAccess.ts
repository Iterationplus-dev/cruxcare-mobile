import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { healthAccessApi } from '@/api/health-access.api';
import type { HealthProfileAccess } from '@/types/care';

/**
 * Shared so every surface that asks "is a therapist waiting on an answer?"
 * asks it under the same key. Four screens had been about to spell this
 * literal out themselves, and a key that drifts by one character is a screen
 * that never refreshes after the client answers.
 *
 * Nested under `['health-profile']` on purpose: granting access changes what a
 * therapist may read, so the decide handler invalidates the whole prefix.
 */
export const healthAccessQueryKey = ['health-profile', 'access'] as const;

export function useHealthProfileAccess() {
  return useQuery({
    queryKey: [...healthAccessQueryKey],
    queryFn: () => healthAccessApi.list(),
  });
}

/**
 * Requests still waiting on the client, most recently asked first.
 *
 * A therapist who asks again reopens the same row rather than raising a second
 * one (backend note §15.3), so this list is one row per therapist and a count
 * of it is a count of people, not of asks.
 */
export function pendingHealthAccess(rows: HealthProfileAccess[] | undefined): HealthProfileAccess[] {
  return (rows ?? [])
    .filter((row) => row.status === 'pending')
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

/** The pending rows alone, for the surfaces that only announce them. */
export function usePendingHealthAccess() {
  const { data, isPending, isError, refetch } = useHealthProfileAccess();
  return {
    data,
    isPending,
    isError,
    refetch,
    pending: computed(() => pendingHealthAccess(data.value)),
  };
}
