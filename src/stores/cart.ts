import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { ordersApi } from '@/api/orders.api';
import type { Cart } from '@/types/marketplace';

/**
 * Cart is app/session state (what's the tab badge count right now?), not
 * server-cache state, so it's Pinia rather than a TanStack Query resource —
 * every mutation still round-trips the server, which recalculates totals.
 */
export const useCartStore = defineStore('cart', () => {
  const cart = ref<Cart | null>(null);
  const loading = ref(false);

  const itemCount = computed(
    () => cart.value?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0,
  );

  async function load() {
    loading.value = true;
    try {
      cart.value = await ordersApi.getCart();
    } finally {
      loading.value = false;
    }
  }

  async function addItem(productId: string, quantity = 1) {
    cart.value = await ordersApi.addItem(productId, quantity);
  }

  async function removeItem(itemId: string) {
    cart.value = await ordersApi.removeItem(itemId);
  }

  function clear() {
    cart.value = null;
  }

  return { cart, loading, itemCount, load, addItem, removeItem, clear };
});
