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

/**
 * Catalogue entries by id, for screens that hold a `productId` and nothing
 * else.
 *
 * Case recommendations carry the id, the captured name and the captured price
 * — deliberately, so a reprice cannot move an agreed bill — but no media. The
 * picture has to come from the catalogue, and a product that has since been
 * delisted simply has none, which `ProductImage` already renders as a
 * placeholder rather than a broken frame.
 */
export function useProductLookup() {
  const { data } = useProducts({});
  const byId = computed(
    () => new Map((data.value?.data ?? []).map((product) => [product.id, product])),
  );
  return {
    /** Undefined when the product is not in the catalogue page we hold. */
    findProduct: (id: string) => byId.value.get(id),
  };
}
