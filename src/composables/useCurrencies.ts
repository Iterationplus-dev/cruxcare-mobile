import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { currenciesApi } from '@/api/currencies.api';
import type { SupportedCurrency } from '@/types/money';

/**
 * Fetched once per session and kept in the query cache. Rates are cached
 * server-side for an hour, so there is nothing to gain from refetching on
 * every mount — but they do move, and a country can be switched off mid
 * session, so `App.vue` invalidates this on foreground.
 */
export function useCurrencies() {
  return useQuery({
    queryKey: ['currencies'],
    queryFn: () => currenciesApi.index(),
    staleTime: 30 * 60_000,
  });
}

/**
 * What the signed-in user will actually be charged in, or null when they have
 * no country on file — which is most existing users, and must look completely
 * normal rather than degraded.
 */
export function useMyCurrency() {
  const { data, isPending } = useCurrencies();

  const mine = computed<SupportedCurrency | null>(() => {
    const index = data.value;
    if (!index?.mine) return null;
    return index.supported.find((c) => c.currency === index.mine) ?? null;
  });

  return {
    index: data,
    isPending,
    mine,
    /** Only `fundable` may gate a currency: a supported currency can be
     * unpriced, and offering it would misprice the payment. */
    canFundInLocalCurrency: computed(() => mine.value?.fundable === true),
  };
}
