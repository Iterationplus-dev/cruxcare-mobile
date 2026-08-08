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
  currency: string;
  lastUpdatedAt: string;
}
