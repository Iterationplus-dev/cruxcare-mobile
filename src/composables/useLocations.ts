import { computed, unref, type MaybeRef } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { locationsApi } from '@/api/locations.api';

/**
 * The two dependent lists. Each stays idle until the level above it is chosen,
 * and a failure resolves to an empty list rather than an error: a missing
 * lookup should degrade the field to free text, not block registration.
 */
export function useStates(countryId: MaybeRef<number | null>) {
  return useQuery({
    queryKey: computed(() => ['locations', 'states', unref(countryId)]),
    queryFn: () => locationsApi.states(unref(countryId) as number),
    enabled: computed(() => unref(countryId) !== null),
    retry: false,
    // A country with no states on file is a normal answer, not a failure.
    throwOnError: false,
  });
}

export function useCities(stateId: MaybeRef<number | null>) {
  return useQuery({
    queryKey: computed(() => ['locations', 'cities', unref(stateId)]),
    queryFn: () => locationsApi.cities(unref(stateId) as number),
    enabled: computed(() => unref(stateId) !== null),
    retry: false,
    throwOnError: false,
  });
}
