import { apiClient } from './client';
import type { CursorPage } from '@/types/api';
import type { Transaction, Wallet } from '@/types/wallet';

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
};
