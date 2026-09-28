import type { LocalBlock } from './money';

export type TransactionType =
  | 'order-payment'
  | 'withdrawal'
  | 'transfer'
  | 'deposit'
  | 'refund'
  | 'adjustment'
  | 'commitment-interest'
  | 'cooperative-contribution'
  | 'cooperative-help'
  | 'rank-earning'
  /**
   * A therapist's share of a client's treatment payment. Deliberately not a
   * `deposit`: money that arrived because somebody was treated is not money
   * they funded, and the two must not share an icon or a sentence.
   */
  | 'earning'
  /** The 10% of each earning carved out into the loyalty purse. */
  | 'loyalty-reserve';

/**
 * The ledger type vocabulary is extensible on the API. Known values remain
 * discoverable to the UI, while an unfamiliar server value is rendered with
 * the generic ledger treatment instead of rejecting the entire response.
 */
export type TransactionTypeLike = TransactionType | (string & {});

export interface Transaction {
  id: string;
  reference: string;
  type: TransactionTypeLike;
  amount: number;
  /** Positive for credits, negative for debits — server-signed, never inferred. */
  fee: number;
  currency: string;
  description: string;
  createdAt: string;
  /**
   * Which purse the row moved. The ledger is one statement across all four, so
   * without this a therapist cannot tell an earning landing in cash from a
   * top-up landing in the e-wallet. Absent on servers that predate the split,
   * which reads as "the e-wallet" — the only purse those servers had.
   */
  wallet?: WalletSlug;
  /** `pending` money is real and visible but not yet withdrawable. */
  status?: LedgerStatus;
}

/**
 * The four purses money sits in.
 *
 * Open-ended for the same reason the ledger vocabulary is: a fifth purse should
 * render with the generic treatment rather than break the wallet screen.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export type WalletSlug = 'cash' | 'ewallet' | 'reward' | 'loyalty' | (string & {});

// eslint-disable-next-line @typescript-eslint/ban-types
export type LedgerStatus = 'pending' | 'cleared' | (string & {});

/**
 * What one purse may be used for.
 *
 * Read rather than assumed. The e-wallet is deliberately not withdrawable —
 * money funded through a gateway leaving through a bank payout is a refund
 * path with different rules — and hard-coding that here means the next purse,
 * or a change to this one, ships as a client release.
 */
export interface WalletCapabilities {
  withdraw: boolean;
  spend: boolean;
  transfer: boolean;
}

export interface WalletPurse {
  /** The server's own ordering, so four purses list the same way everywhere. */
  key: number;
  slug: WalletSlug;
  /** Server-written, so a renamed purse does not need an app release. */
  name: string;
  available: number;
  pending: number;
  currency: string;
  capabilities: WalletCapabilities;
  /**
   * The floor a withdrawal has to clear, measured against the *balance* rather
   * than the request: someone on $120 may take $20, someone on $80 may take
   * nothing. Null where the purse has no floor.
   */
  minimumWithdrawal?: number | null;
  minimumReached?: boolean;
  local?: LocalBlock<'available' | 'pending'> | null;
}

/**
 * When a withdrawal may be asked for, and when the money actually goes out.
 *
 * Requesting and being paid are different acts on different days, so this
 * carries both. Never computed on the device: "is it Tuesday?" is a question
 * about the server's clock and the server's calendar, not the handset's.
 */
export interface WithdrawalWindow {
  open: boolean;
  opensAt: string | null;
  closesAt: string | null;
  /** When the next payout run disburses, which is not when a request is made. */
  nextPayoutAt: string | null;
  /** Written for display, e.g. "Tuesday to Friday". */
  requestDays?: string | null;
  payoutDay?: string | null;
}

export interface Wallet {
  available: number;
  pending: number;
  /** Server-reported allocations. They are not derived from the available balance in the UI. */
  committed?: number;
  cooperativeSaved?: number;
  currency: string;
  lastUpdatedAt: string;
  /**
   * Every purse, keyed by slug.
   *
   * `available`, `pending` and `cooperativeSaved` above are unchanged and still
   * mean the *e-wallet*, so a build that ignores this block behaves exactly as
   * it did. Screens that show balances should read this instead: three of the
   * four purses were invisible while the top-level figures were the whole story.
   */
  wallets?: Partial<Record<WalletSlug, WalletPurse>>;
  /** When a withdrawal may be requested, and when it is paid out. */
  withdrawalWindow?: WithdrawalWindow;
  /**
   * The same balances shown in the user's own currency, for display only.
   * Null — the whole object, never an object of zeroes — when the user has no
   * supported country or no rate could be established. A zero would render as
   * a real, empty balance.
   */
  local: LocalBlock<'available' | 'pending' | 'cooperativeSaved'> | null;
}

export type MoneyActionKind = 'withdrawal' | 'transfer' | 'cooperative-contribution';

export interface MoneyQuoteRequest {
  kind: MoneyActionKind;
  amount: number;
  recipient?: string;
  /**
   * Which purse a withdrawal empties. Only `cash` and `loyalty` are accepted —
   * transfers and cooperative contributions are unchanged and still spend the
   * e-wallet, so they send nothing here.
   *
   * Omitted defaults to `cash` server-side, which is the behaviour change worth
   * knowing about: a build that sends no wallet now withdraws from earnings,
   * not from funded money.
   */
  wallet?: WalletSlug;
}

/** Returned by the server. Never derive fees or resulting balances in a view. */
export interface MoneyQuote {
  id: string;
  kind: MoneyActionKind;
  amount: number;
  fee: number;
  recipientReceives: number;
  balanceAfter: number;
  currency: string;
  expiresAt: string;
  recipient?: string;
  /** The quote converted for display. For a withdrawal this is what actually
   * lands in the user's bank account. Null follows the same rule as `Wallet`. */
  local: LocalBlock<'amount' | 'fee' | 'recipientReceives' | 'balanceAfter'> | null;
}

/**
 * A priced top-up. Funding is the one money flow the customer names the figure
 * for, so the amount is sent — but the *charge* still comes back from the
 * server, because the gateway fee and any funding limits are not the device's
 * to work out. The payment intent is then opened against `id`, never against a
 * figure this app composed.
 */
export interface WalletTopUpQuote {
  id: string;
  /** What the customer asked to add to their wallet. */
  amount: number;
  /** Gateway/processing charge, added on top of `amount`. */
  fee: number;
  /** What the customer actually pays: `amount + fee`. Never derived here. */
  totalCharge: number;
  /** What lands in the wallet once the payment settles — the full `amount`,
   * since the fee is charged on top rather than taken out of it. */
  walletCreditedWith: number;
  balanceAfter: number;
  currency: string;
  /** 30 minutes, not the 5 a money quote gets: funding by bank transfer means
   * leaving the app to complete the payment. */
  expiresAt: string;
  /**
   * What the gateway will actually charge, in the payer's own currency.
   * Restates only the figures being charged — `balanceAfter` stays USD,
   * because that is the currency the wallet is held in.
   */
  local: LocalBlock<'amount' | 'fee' | 'totalCharge'> | null;
}

export interface MoneySubmission {
  reference: string;
  status: 'processing';
  quote: MoneyQuote;
}
