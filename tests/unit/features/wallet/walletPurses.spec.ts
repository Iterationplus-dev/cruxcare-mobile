import { describe, expect, it } from 'vitest';
import {
  pendingExplanation,
  purseOf,
  pursesOf,
  windowSummary,
  withdrawBlocker,
  withdrawablePurses,
} from '@/features/wallet/walletPurses';
import type { Wallet, WalletPurse } from '@/types/wallet';

function purse(over: Partial<WalletPurse> = {}): WalletPurse {
  return {
    key: 0,
    slug: 'cash',
    name: 'Cash',
    available: 94.5,
    pending: 0,
    currency: 'USD',
    capabilities: { withdraw: true, spend: false, transfer: false },
    minimumWithdrawal: null,
    minimumReached: true,
    local: null,
    ...over,
  };
}

function wallet(over: Partial<Wallet> = {}): Wallet {
  return {
    available: 10,
    pending: 0,
    currency: 'USD',
    lastUpdatedAt: '2026-09-16T09:00:00Z',
    local: null,
    ...over,
  };
}

describe('pursesOf', () => {
  it('returns nothing when the server sends no wallets block', () => {
    // Not an empty wallet: that server's top-level balances still mean the
    // e-wallet, so the caller falls back rather than rendering zero purses.
    expect(pursesOf(wallet())).toEqual([]);
    expect(pursesOf(undefined)).toEqual([]);
  });

  it('orders purses by the key the server assigns, not by object order', () => {
    const rows = pursesOf(
      wallet({
        wallets: {
          loyalty: purse({ key: 3, slug: 'loyalty', name: 'Loyalty' }),
          cash: purse({ key: 0, slug: 'cash', name: 'Cash' }),
          ewallet: purse({ key: 1, slug: 'ewallet', name: 'E-wallet' }),
        },
      }),
    );

    expect(rows.map((p) => p.slug)).toEqual(['cash', 'ewallet', 'loyalty']);
  });
});

describe('withdrawablePurses', () => {
  it('reads the capability flag rather than the slug', () => {
    // The e-wallet deliberately does not pay out — gateway money leaving
    // through a bank payout is a refund path, not a withdrawal — and which
    // purses pay out is the server's rule, not a list kept in the app.
    const rows = withdrawablePurses(
      wallet({
        wallets: {
          cash: purse({ key: 0, slug: 'cash' }),
          ewallet: purse({
            key: 1,
            slug: 'ewallet',
            capabilities: { withdraw: false, spend: true, transfer: true },
          }),
          loyalty: purse({ key: 3, slug: 'loyalty' }),
        },
      }),
    );

    expect(rows.map((p) => p.slug)).toEqual(['cash', 'loyalty']);
  });
});

describe('withdrawBlocker', () => {
  it('names why a purse cannot pay out, using only what the server said', () => {
    expect(withdrawBlocker(purse())).toBeNull();
    expect(
      withdrawBlocker(purse({ capabilities: { withdraw: false, spend: true, transfer: false } })),
    ).toBe('not-withdrawable');
    // The floor is about the balance, not the request — so this is a property
    // of the purse and the app never compares the figures itself.
    expect(withdrawBlocker(purse({ minimumReached: false }))).toBe('below-minimum');
    expect(withdrawBlocker(purse({ available: 0 }))).toBe('nothing-cleared');
  });
});

describe('pendingExplanation', () => {
  it('says nothing when nothing is clearing', () => {
    expect(pendingExplanation(purse({ pending: 0 }))).toBeNull();
  });

  it('explains a cash balance that is visible but not yet payable', () => {
    // `available: 0` beside `pending: 66.15` is correct and is the single most
    // likely figure on the wallet screen to be read as a bug.
    expect(pendingExplanation(purse({ available: 0, pending: 66.15 }))).toContain(
      'finishes paying',
    );
  });
});

describe('windowSummary', () => {
  it('says nothing when the server sends no window', () => {
    expect(windowSummary(undefined)).toBeNull();
  });

  it('names the payout day while open, because requesting is not being paid', () => {
    const line = windowSummary({
      open: true,
      opensAt: null,
      closesAt: '2026-09-18T23:59:59Z',
      nextPayoutAt: '2026-09-21T09:00:00Z',
    });

    expect(line).toContain('Open now');
    expect(line).toContain('Monday');
  });

  it('names when it reopens while shut', () => {
    const line = windowSummary({
      open: false,
      opensAt: '2026-09-22T00:00:00Z',
      closesAt: null,
      nextPayoutAt: '2026-09-21T09:00:00Z',
    });

    expect(line).toContain('Closed');
    expect(line).toContain('Tuesday');
  });
});

describe('purseOf', () => {
  it('returns null for a purse this wallet does not hold', () => {
    expect(purseOf(wallet({ wallets: { cash: purse() } }), 'reward')).toBeNull();
  });
});
