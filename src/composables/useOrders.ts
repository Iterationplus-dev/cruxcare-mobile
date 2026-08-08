import { useQuery } from '@tanstack/vue-query';
import { ordersApi } from '@/api/orders.api';

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.list(),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: ['orders', id],
    queryFn: () => ordersApi.get(id),
  });
}
