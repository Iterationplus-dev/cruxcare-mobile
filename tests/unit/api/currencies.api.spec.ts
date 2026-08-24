import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currenciesApi } from '@/api/currencies.api';
import { walletApi } from '@/api/wallet.api';
import { useAuthStore } from '@/stores/auth';
import { demoCredentials, userCurrency } from '@/mocks/db';

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

describe('currenciesApi', () => {
  beforeEach(async () => {
    userCurrency.set('user-1', 'NGN');
    await signIn();
  });

  it('settles in USD whatever the caller currency is', async () => {
    const index = await currenciesApi.index();
    expect(index.base).toBe('USD');
  });

  it('resolves the caller own currency server-side', async () => {
    const index = await currenciesApi.index();
    // Non-null means the UI must not ask the user to pick one.
    expect(index.mine).toBe('NGN');
  });

  it('reports an unpriced currency as present but not fundable', async () => {
    const index = await currenciesApi.index();
    const cameroon = index.supported.find((c) => c.currency === 'XAF');

    expect(cameroon).toBeDefined();
    expect(cameroon!.fundable).toBe(false);
    expect(cameroon!.rate).toBeNull();
  });

  it('keeps the per-currency rateSource distinct from the platform source', async () => {
    const index = await currenciesApi.index();
    expect(index.source).toBe('official');
    // The platform is on official rates, but this currency fell back.
    expect(index.supported.find((c) => c.currency === 'XAF')!.rateSource).toBe('system');
  });
});

describe('wallet local block', () => {
  beforeEach(async () => {
    userCurrency.set('user-1', 'NGN');
    await signIn();
  });

  it('mirrors the base amount keys, converted', async () => {
    const wallet = await walletApi.get();

    expect(wallet.currency).toBe('USD');
    expect(wallet.local).not.toBeNull();
    expect(wallet.local!.currency).toBe('NGN');
    expect(wallet.local!.available).toBeCloseTo(wallet.available * wallet.local!.rate, 0);
  });

  it('is null — not zero — for a user with no country on file', async () => {
    userCurrency.delete('user-1');
    const wallet = await walletApi.get();

    // A zero would render as a real, empty balance.
    expect(wallet.local).toBeNull();
    expect(wallet.available).toBeGreaterThan(0);
  });

  it('carries its own rate on a money quote so settlement honours what was shown', async () => {
    const quote = await walletApi.quoteMoneyAction({ kind: 'withdrawal', amount: 100 });

    expect(quote.currency).toBe('USD');
    expect(quote.local).not.toBeNull();
    expect(quote.local!.rate).toBeGreaterThan(0);
    expect(quote.local!.recipientReceives).toBeCloseTo(
      quote.recipientReceives * quote.local!.rate,
      0,
    );
  });
});
