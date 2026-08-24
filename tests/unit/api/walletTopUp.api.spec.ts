import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { walletApi } from '@/api/wallet.api';
import { paymentsApi } from '@/api/payments.api';
import { useAuthStore } from '@/stores/auth';
import { demoCredentials } from '@/mocks/db';
import { ApiError } from '@/types/api';

vi.mock('@/services/secureStorage', () => ({
  secureStorage: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  SECURE_STORAGE_KEYS: { authToken: 'cc_auth_token', pushInstallationId: 'cc_push_id' },
}));

async function signIn() {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  await auth.login(demoCredentials.identifier, demoCredentials.password);
  return auth;
}

describe('wallet top-up', () => {
  beforeEach(async () => {
    await signIn();
  });

  it('has the server derive the charge from the requested amount', async () => {
    const quote = await walletApi.quoteTopUp(100);

    expect(quote.amount).toBe(100);
    expect(quote.walletCreditedWith).toBe(100);
    // The customer names the amount; the fee and total come back from the API.
    expect(quote.fee).toBeGreaterThan(0);
    expect(quote.totalCharge).toBeCloseTo(quote.amount + quote.fee, 2);
    expect(quote.balanceAfter).toBeGreaterThan(quote.amount);
  });

  it('converts only the charged figures, leaving the balance in USD', async () => {
    const quote = await walletApi.quoteTopUp(50);

    expect(quote.local).not.toBeNull();
    expect(quote.local!.currency).toBe('NGN');
    expect(quote.local!.totalCharge).toBeCloseTo(quote.totalCharge * quote.local!.rate, 0);
    expect(quote.local!.amount).toBeCloseTo(quote.amount * quote.local!.rate, 0);
    // `balanceAfter` has no local twin: the wallet is held in USD.
    expect(quote.currency).toBe('USD');
    expect(quote.balanceAfter).toBeGreaterThan(0);
  });

  it('adds the fee on top rather than taking it out of the credit', async () => {
    const quote = await walletApi.quoteTopUp(50);

    expect(quote.walletCreditedWith).toBe(quote.amount);
    expect(quote.totalCharge).toBeCloseTo(quote.amount + quote.fee, 2);
  });

  it('gives the quote long enough to leave the app and pay by transfer', async () => {
    const quote = await walletApi.quoteTopUp(50);
    const minutes = (new Date(quote.expiresAt).getTime() - Date.now()) / 60_000;

    expect(minutes).toBeGreaterThan(20);
  });

  it('rejects an amount below the funding minimum', async () => {
    await expect(walletApi.quoteTopUp(1)).rejects.toThrow(ApiError);
  });

  it('prices the payment intent from the quote the customer reviewed', async () => {
    const quote = await walletApi.quoteTopUp(50);
    const intent = await paymentsApi.createIntent({
      purpose: 'wallet-topup',
      subject: quote.id,
      expectedAmount: quote.totalCharge,
      expectedCurrency: quote.currency,
      channel: 'bank-transfer',
    });

    // The quote stays in USD; the intent charges the payer in their own
    // currency, so the two figures deliberately differ for this user.
    expect(quote.currency).toBe('USD');
    expect(intent.currency).toBe('NGN');
    expect(intent.amount).toBeGreaterThan(quote.totalCharge);
    expect(intent.reference).toMatch(/^CCPAY-/);
  });

  it('refuses an intent against an unknown top-up quote', async () => {
    await expect(
      paymentsApi.createIntent({ purpose: 'wallet-topup', subject: 'topup-nope' }),
    ).rejects.toThrow(ApiError);
  });

  it('credits the wallet once, however many times settlement is observed', async () => {
    const before = await walletApi.get();
    const quote = await walletApi.quoteTopUp(25);
    const intent = await paymentsApi.createIntent({
      purpose: 'wallet-topup',
      subject: quote.id,
      expectedAmount: quote.totalCharge,
    });

    // The mock holds the first confirm at `pending`, mirroring a real gateway.
    const pending = await paymentsApi.confirm(intent.reference, 'MNFY|1');
    expect(pending.status).toBe('pending');
    expect((await walletApi.get()).available).toBe(before.available);

    const settled = await paymentsApi.confirm(intent.reference, 'MNFY|1');
    expect(settled.status).toBe('settled');
    const funded = await walletApi.get();
    expect(funded.available).toBeCloseTo(before.available + 25, 2);

    // A retry, and the polling GET, must not credit a second time.
    await paymentsApi.confirm(intent.reference, 'MNFY|1');
    await paymentsApi.get(intent.reference);
    expect((await walletApi.get()).available).toBeCloseTo(funded.available, 2);
  });
});
