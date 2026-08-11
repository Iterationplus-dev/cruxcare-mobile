export type TransactionType =
  | 'order-payment'
  | 'withdrawal'
  | 'transfer'
  | 'commitment-interest'
  | 'cooperative-contribution'
  | 'cooperative-help'
  | 'rank-earning';

export interface Transaction {
  id: string;
  reference: string;
  type: TransactionType;
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
}

export type MoneyActionKind = 'withdrawal' | 'transfer';

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
}

export interface MoneySubmission {
  reference: string;
  status: 'processing';
  quote: MoneyQuote;
}
