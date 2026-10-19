import { apiClient, idempotencyHeader } from './client';
import type { CursorPage } from '@/types/api';
import type { Cart, CheckoutQuote, Order } from '@/types/marketplace';

export const ordersApi = {
  async getCart(): Promise<Cart> {
    const { data } = await apiClient.get<Cart>('/cart');
    return data;
  },

  async addItem(productId: string, quantity: number): Promise<Cart> {
    const { data } = await apiClient.post<Cart>('/cart/items', { productId, quantity });
    return data;
  },

  async removeItem(itemId: string): Promise<Cart> {
    const { data } = await apiClient.delete<Cart>(`/cart/items/${itemId}`);
    return data;
  },

  /** Server-priced totals shown before paying (C4) — never computed client-side. */
  async quoteCheckout(): Promise<CheckoutQuote> {
    const { data } = await apiClient.get<CheckoutQuote>('/cart/checkout-quote');
    return data;
  },

  /**
   * Places an order that is already paid for. `paymentToken` is `wallet` (the
   * server debits it, or refuses with `insufficient_funds`) or the `CCPAY-…`
   * reference of a settled card payment; anything else is
   * `payment_method_unsupported`. The server never places a paid card order by
   * itself, so this must be called once the payment settles.
   */
  async checkout(idempotencyKey: string, paymentToken: string): Promise<Order> {
    const { data } = await apiClient.post<Order>(
      '/orders',
      { paymentToken },
      idempotencyHeader(idempotencyKey),
    );
    return data;
  },

  async onBehalf(clientId: string, idempotencyKey: string, paymentToken: string): Promise<Order> {
    const { data } = await apiClient.post<Order>(
      '/orders/on-behalf',
      { clientId, paymentToken },
      idempotencyHeader(idempotencyKey),
    );
    return data;
  },

  async list(cursor?: string): Promise<CursorPage<Order>> {
    const { data } = await apiClient.get<CursorPage<Order>>('/orders', { params: { cursor } });
    return data;
  },

  async get(id: string): Promise<Order> {
    const { data } = await apiClient.get<Order>(`/orders/${id}`);
    return data;
  },
};
