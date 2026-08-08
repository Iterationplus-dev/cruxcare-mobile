import { computed, type Ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { productsApi, type ProductQuery } from '@/api/products.api';

export function useProducts(query: Ref<ProductQuery> | ProductQuery = {}) {
  const params = computed(() => ('value' in query ? query.value : query));
  return useQuery({
    queryKey: ['products', params],
    queryFn: () => productsApi.list(params.value),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: () => productsApi.get(id),
  });
}
