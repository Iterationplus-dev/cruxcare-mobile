import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';
import { demoCredentials, resetCart } from '@/mocks/db';

describe('useCartStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    resetCart('user-1'); // the mock cart otherwise persists across tests in this file
    const auth = useAuthStore();
    await auth.login(demoCredentials.identifier, demoCredentials.password);
  });

  it('starts empty until loaded', async () => {
    const cart = useCartStore();
    await cart.load();
    expect(cart.itemCount).toBe(0);
  });

  it('adds items and recalculates the item count from the server response', async () => {
    const cart = useCartStore();
    await cart.load();
    await cart.addItem('prod-1', 2);
    expect(cart.itemCount).toBe(2);
    expect(cart.cart?.subtotal).toBeGreaterThan(0);
  });

  it('removes an item by id', async () => {
    const cart = useCartStore();
    await cart.load();
    await cart.addItem('prod-2', 1);
    const itemId = cart.cart?.items[0]?.id;
    expect(itemId).toBeTruthy();
    await cart.removeItem(itemId!);
    expect(cart.itemCount).toBe(0);
  });
});
