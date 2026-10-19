import { ApiError } from '@/types/api';
import { secureStorage, SECURE_STORAGE_KEYS } from '@/services/secureStorage';
import { formatMoney } from '@/utils/money';
import type { CheckoutQuote } from '@/types/marketplace';

/**
 * A card payment taken for a checkout, kept until it has become an order.
 *
 * The card is charged first and the order placed after, and the server never
 * places a paid order by itself — so a user who closes the app between the two
 * would have paid for nothing. `orderKey` is the idempotency key of the
 * `POST /orders` that turns it into an order, kept with it so a retry after a
 * dropped response finds the same order rather than placing a second one.
 */
export interface PendingOrderPayment {
  reference: string;
  orderKey: string;
}

export const pendingOrderPayment = {
  async load(): Promise<PendingOrderPayment | null> {
    const raw = await secureStorage.get(SECURE_STORAGE_KEYS.pendingOrderPayment);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<PendingOrderPayment>;
      return typeof parsed.reference === 'string' && typeof parsed.orderKey === 'string'
        ? { reference: parsed.reference, orderKey: parsed.orderKey }
        : null;
    } catch {
      return null;
    }
  },

  async save(payment: PendingOrderPayment): Promise<void> {
    await secureStorage.set(SECURE_STORAGE_KEYS.pendingOrderPayment, JSON.stringify(payment));
  },

  async clear(): Promise<void> {
    await secureStorage.remove(SECURE_STORAGE_KEYS.pendingOrderPayment);
  },
};

/** "You need $35.00 more", from the quote's own figure. Null when the wallet covers it. */
export function quoteShortfall(quote: CheckoutQuote): string | null {
  if (quote.walletSufficient) return null;
  const short = Math.max(0, -quote.walletBalanceAfter);
  return short > 0 ? `You need ${formatMoney(short, quote.currency)} more` : 'Your wallet balance is too low';
}

/**
 * What the checkout does after `POST /orders` refuses. Only
 * `order_failed_refunded` means money moved, and it moved back to the wallet.
 *
 * - `shortfall`: the wallet can't cover it — offer card or a top-up.
 * - `not_settled`: the card payment isn't confirmed yet — confirm again, retry.
 * - `restart_payment`: the reference is no good — take a new card payment.
 * - `restart_checkout`: the payment can't pay for this cart — start over.
 * - `refunded`: paid, but the order couldn't be filled — the money is in the wallet.
 * - `refresh`: the cart moved under a wallet order — re-read it and re-quote.
 * - `other`: anything else, shown as-is.
 */
export type CheckoutFailure =
  | { kind: 'shortfall'; message: string }
  | { kind: 'not_settled' }
  | { kind: 'restart_payment'; message: string }
  | { kind: 'restart_checkout'; message: string }
  | { kind: 'refunded'; message: string }
  | { kind: 'refresh'; message: string }
  | { kind: 'other'; error: unknown };

const REFRESH_CODES = ['insufficient_stock', 'product_unavailable', 'price_changed', 'checkout_quote_expired'];

export function checkoutFailure(error: unknown): CheckoutFailure {
  if (!(error instanceof ApiError)) return { kind: 'other', error };

  switch (error.code) {
    case 'insufficient_funds': {
      const available = Number(error.meta?.available);
      const required = Number(error.meta?.required);
      const currency = typeof error.meta?.currency === 'string' ? error.meta.currency : null;
      const short = Math.round((required - available) * 100) / 100;
      return {
        kind: 'shortfall',
        message:
          currency && Number.isFinite(short) && short > 0
            ? `Your wallet is ${formatMoney(short, currency)} short. Pay by card or top up your wallet.`
            : error.message,
      };
    }
    case 'payment_not_settled':
      return { kind: 'not_settled' };
    case 'payment_not_found':
      return { kind: 'restart_payment', message: error.message };
    case 'payment_subject_mismatch':
    case 'payment_refunded':
      return { kind: 'restart_checkout', message: error.message };
    case 'order_failed_refunded':
      return { kind: 'refunded', message: error.message };
    default:
      if (REFRESH_CODES.includes(error.code ?? '')) return { kind: 'refresh', message: error.message };
      // `payment_method_unsupported` lands here too: it is this app sending a
      // token other than `wallet` or `CCPAY-…`, which is a bug, not a choice
      // the user can make differently.
      return { kind: 'other', error };
  }
}

/** Whether a stored card payment can no longer become an order. */
export function endsPendingPayment(failure: CheckoutFailure): boolean {
  return ['restart_payment', 'restart_checkout', 'refunded'].includes(failure.kind) ||
    (failure.kind === 'other' && failure.error instanceof ApiError && failure.error.code === 'payment_method_unsupported');
}
