import { computed, isRef, type MaybeRef, type MaybeRefOrGetter, toValue } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { therapistsApi } from '@/api/therapists.api';
import type { TherapistGender } from '@/types/care';

/**
 * The directory. `gender` filters server-side, so it belongs in the query key
 * — filtering in the browser would only ever narrow the page already loaded.
 */
export function useTherapists(
  gender?: MaybeRefOrGetter<TherapistGender | null>,
  enabled?: MaybeRefOrGetter<boolean>,
) {
  return useQuery({
    queryKey: computed(() => ['therapists', toValue(gender) ?? null]),
    queryFn: () => therapistsApi.list({ gender: toValue(gender) ?? undefined }),
    // A client who already has a therapist is not shown the directory, so it
    // is not fetched either — no other therapist's details reach the device.
    enabled: computed(() => toValue(enabled) ?? true),
    // Keeps the current rows on screen while a filter refetches, rather than
    // flashing an empty directory between taps.
    placeholderData: (previous) => previous,
  });
}

/**
 * Whether this client may ask a new therapist, and who they are tied to if
 * not. One call for the whole directory rather than one per card.
 */
export function useCareEngagement() {
  return useQuery({
    queryKey: ['care-engagement'],
    queryFn: () => therapistsApi.engagement(),
  });
}

/**
 * Accepts a plain id or a ref/computed — several callers (e.g. CareHubScreen)
 * only learn the id after another query resolves, so a plain string
 * argument would freeze the queryKey at whatever it was during setup().
 */
export function useTherapist(id: MaybeRef<string>) {
  const idRef = isRef(id) ? id : computed(() => id);
  return useQuery({
    queryKey: computed(() => ['therapists', idRef.value]),
    queryFn: () => therapistsApi.get(idRef.value),
    enabled: computed(() => !!idRef.value),
  });
}
