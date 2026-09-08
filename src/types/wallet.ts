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
  | 'rank-earning';

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
