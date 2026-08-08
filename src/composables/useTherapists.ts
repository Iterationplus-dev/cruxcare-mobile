import { computed, isRef, type MaybeRef } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { therapistsApi } from '@/api/therapists.api';

export function useTherapists() {
  return useQuery({
    queryKey: ['therapists'],
    queryFn: () => therapistsApi.list(),
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
