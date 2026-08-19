import { apiClient, idempotencyHeader, newIdempotencyKey } from './client';
import type {
  CreatePaymentIntentPayload,
  PaymentConfirmation,
  PaymentIntent,
} from '@/types/payments';

/**
 * The server side of a gateway payment. Opening an intent and confirming it
 * are both money writes, so both carry an idempotency key — a retry after a
 * dropped response must never open a second charge or double-apply one.
 */
export const paymentsApi = {
  /** Prices the purchase server-side and mints the reference the SDK will use. */
  async createIntent(payload: CreatePaymentIntentPayload): Promise<PaymentIntent> {
    const { data } = await apiClient.post<PaymentIntent>(
      '/payments/intents',
      payload,
      idempotencyHeader(newIdempotencyKey()),
    );
    return data;
  },

  /**
   * Asks the server what actually happened. `gatewayReference` is a hint that
   * lets the server verify immediately instead of waiting for the webhook; it
   * is not evidence of payment and the server must re-check it with Monnify.
   */
  async confirm(reference: string, gatewayReference: string | null): Promise<PaymentConfirmation> {
    const { data } = await apiClient.post<PaymentConfirmation>(
      `/payments/intents/${encodeURIComponent(reference)}/confirm`,
      { gatewayReference },
      idempotencyHeader(newIdempotencyKey()),
    );
    return data;
  },

  /** Polled while an intent sits in `pending` — e.g. a bank transfer still in flight. */
  async get(reference: string): Promise<PaymentConfirmation> {
    const { data } = await apiClient.get<PaymentConfirmation>(
      `/payments/intents/${encodeURIComponent(reference)}`,
    );
    return data;
  },
};
