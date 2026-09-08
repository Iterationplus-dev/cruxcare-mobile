import { apiClient } from './client';
import type { CurrencyIndex } from '@/types/money';

/**
 * The only source of truth for which currencies exist and what they are worth.
 * Nothing about this list may be hard-coded: countries are switched on and off
 * in the admin, and a currency can be present but temporarily unpriced.
 */
export const currenciesApi = {
  async index(): Promise<CurrencyIndex> {
    const { data } = await apiClient.get<CurrencyIndex>('/currencies');
    return data;
  },
};
