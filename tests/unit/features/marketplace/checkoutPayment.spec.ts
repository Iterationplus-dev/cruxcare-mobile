import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkoutFailure,
  endsPendingPayment,
  pendingOrderPayment,
  quoteShortfall,
} from '@/features/marketplace/checkoutPayment';
import { ApiError } from '@/types/api';
import type { CheckoutQuote } from '@/types/marketplace';

const quote = (overrides: Partial<CheckoutQuote> = {}): CheckoutQuote => ({
  quoteId: '9b2f0c4e-6a1d-4c8e-b7f3-2d5a8e1c0f94',
  subtotal: 40,
  fees: 0,
  total: 40,
  currency: 'USD',
  walletBalanceAfter: -35,
  walletSufficient: false,
  paymentMethods: ['wallet', 'card'],
  expiresAt: '2026-10-19T10:40:00Z',
  ...overrides,
});

const apiError = (status: number, code: string, meta?: Record<string, unknown>) =>
  new ApiError(status, { code, message: `server says ${code}`, meta });

describe('quote shortfall', () => {
  it('names the amount missing from the wallet', () => {
    expect(quoteShortfall(quote())).toBe('You need $35.00 more');
  });

  it('is null when the wallet covers the total', () => {
    expect(quoteShortfall(quote({ walletSufficient: true, walletBalanceAfter: 60 }))).toBeNull();
  });
});

describe('checkout failure', () => {
  it('turns insufficient_funds into the shortfall', () => {
    const failure = checkoutFailure(
      apiError(422, 'insufficient_funds', { available: 10, required: 20, currency: 'USD' }),
    );
    expect(failure).toEqual({
      kind: 'shortfall',
      message: 'Your wallet is $10.00 short. Pay by card or top up your wallet.',
    });
  });

  it('keeps the API message when the shortfall meta is missing', () => {
    expect(checkoutFailure(apiError(422, 'insufficient_funds'))).toEqual({
      kind: 'shortfall',
      message: 'server says insufficient_funds',
    });
  });

  it.each([
    ['payment_not_settled', 409, 'not_settled'],
    ['payment_not_found', 422, 'restart_payment'],
    ['payment_subject_mismatch', 422, 'restart_checkout'],
    ['payment_refunded', 422, 'restart_checkout'],
    ['order_failed_refunded', 422, 'refunded'],
    ['insufficient_stock', 422, 'refresh'],
    ['product_unavailable', 422, 'refresh'],
    ['price_changed', 422, 'refresh'],
    ['checkout_quote_expired', 422, 'refresh'],
    ['payment_method_unsupported', 422, 'other'],
  ])('maps %s to %s', (code, status, kind) => {
    expect(checkoutFailure(apiError(status, code)).kind).toBe(kind);
  });

  it('only gives up on a stored card payment when it can never become an order', () => {
    const ends = (code: string) => endsPendingPayment(checkoutFailure(apiError(422, code)));
    expect(ends('payment_not_found')).toBe(true);
    expect(ends('payment_refunded')).toBe(true);
    expect(ends('order_failed_refunded')).toBe(true);
    expect(ends('payment_method_unsupported')).toBe(true);
    expect(ends('payment_not_settled')).toBe(false);
    expect(ends('insufficient_stock')).toBe(false);
    expect(endsPendingPayment(checkoutFailure(new ApiError(0, { message: 'Network error.' })))).toBe(false);
  });
});

describe('pending order payment', () => {
  beforeEach(() => pendingOrderPayment.clear());

  it('survives until cleared', async () => {
    await pendingOrderPayment.save({ reference: 'CCPAY-1', orderKey: 'key-1' });
    expect(await pendingOrderPayment.load()).toEqual({ reference: 'CCPAY-1', orderKey: 'key-1' });
    await pendingOrderPayment.clear();
    expect(await pendingOrderPayment.load()).toBeNull();
  });
});
