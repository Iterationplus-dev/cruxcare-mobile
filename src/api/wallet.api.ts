import { apiClient, idempotencyHeader, newIdempotencyKey } from './client';
import type { CursorPage } from '@/types/api';
import type { MoneyQuote, MoneyQuoteRequest, MoneySubmission, Transaction, Wallet } from '@/types/wallet';

/** Read-only surface for this build — withdraw/transfer land in the Finance phase. */
export const walletApi = {
  async get(): Promise<Wallet> {
    const { data } = await apiClient.get<Wallet>('/wallet');
    return data;
  },

  async ledger(cursor?: string): Promise<CursorPage<Transaction>> {
    const { data } = await apiClient.get<CursorPage<Transaction>>('/wallet/ledger', {
      params: { cursor },
    });
    return data;
  },

  async quoteMoneyAction(payload: MoneyQuoteRequest): Promise<MoneyQuote> {
    const { data } = await apiClient.post<MoneyQuote>('/wallet/quotes', payload, idempotencyHeader(newIdempotencyKey()));
    return data;
  },

  async verifyMoneyStepUp(quoteId: string, code: string): Promise<void> {
    await apiClient.post('/wallet/quotes/' + quoteId + '/step-up', { code }, idempotencyHeader(newIdempotencyKey()));
  },

  async submitMoneyAction(quoteId: string): Promise<MoneySubmission> {
    const { data } = await apiClient.post<MoneySubmission>('/wallet/actions', { quoteId }, idempotencyHeader(newIdempotencyKey()));
    return data;
  },
};
