import type { Wallet, WalletPurse, WalletSlug, WithdrawalWindow } from '@/types/wallet';

/**
 * The purses a wallet holds, in the server's own order.
 *
 * Read off `wallets` and sorted by the `key` the server assigns rather than by
 * a list written here: three of the four purses were invisible in the app while
 * the top-level balances were the whole story, and hard-coding the four that
 * exist today would make the fifth invisible in exactly the same way.
 *
 * An older server sends no `wallets` block at all. That is not an empty wallet
 * — its top-level balances still mean the e-wallet — so this returns nothing
 * and the caller falls back to the single-balance rendering it already had.
 */
export function pursesOf(wallet: Wallet | undefined): WalletPurse[] {
  const block = wallet?.wallets;
  if (!block) return [];
  return Object.values(block)
    .filter((purse): purse is WalletPurse => !!purse)
    .sort((a, b) => a.key - b.key);
}

export function purseOf(wallet: Wallet | undefined, slug: WalletSlug): WalletPurse | null {
  return wallet?.wallets?.[slug] ?? null;
}

/** The purses a withdrawal may actually empty. Read from the capability flags,
 *  never from the slug: which purses pay out is the server's rule. */
export function withdrawablePurses(wallet: Wallet | undefined): WalletPurse[] {
  return pursesOf(wallet).filter((purse) => purse.capabilities.withdraw);
}

/**
 * Why a purse cannot be withdrawn from right now, or null when it can.
 *
 * Only ever a reason the server has already told us — the floor and whether it
 * is met both come from the purse. The app does not compare figures itself: a
 * device deciding somebody has reached $100 is a device disagreeing with the
 * ledger.
 */
export function withdrawBlocker(purse: WalletPurse | null): 'not-withdrawable' | 'below-minimum' | 'nothing-cleared' | null {
  if (!purse) return null;
  if (!purse.capabilities.withdraw) return 'not-withdrawable';
  if (purse.minimumReached === false) return 'below-minimum';
  if (purse.available <= 0) return 'nothing-cleared';
  return null;
}

/**
 * What the wallet screen says about money that is visible but not yet payable.
 *
 * `available: 0` beside `pending: 66.15` is a normal, correct state for a
 * therapist whose client is midway through paying — and the single most likely
 * thing on this screen to be read as a bug. It is worth a sentence every time
 * rather than only when someone asks.
 */
export function pendingExplanation(purse: WalletPurse): string | null {
  if (purse.pending <= 0) return null;
  if (purse.slug === 'cash') return 'Clears when your client finishes paying for their course.';
  return 'Still clearing.';
}

/**
 * When withdrawals next open, said as a sentence.
 *
 * Every date is the server's. Working out "is it Tuesday?" on the handset asks
 * the wrong clock and the wrong calendar, and a therapist travelling would get
 * a different answer from the one the server is about to enforce.
 */
export function windowSummary(window: WithdrawalWindow | undefined): string | null {
  if (!window) return null;
  if (window.open) {
    return window.nextPayoutAt
      ? `Open now. Approved requests are paid out ${formatDay(window.nextPayoutAt)}.`
      : 'Open now.';
  }
  if (window.opensAt) return `Closed. Opens again ${formatDay(window.opensAt)}.`;
  if (window.requestDays) return `Closed. Requests are taken ${window.requestDays}.`;
  return 'Closed right now.';
}

function formatDay(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 'soon';
  return at.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
}
