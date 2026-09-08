/**
 * Local-currency display. The rule that shapes every type here:
 * **USD is the only currency anything is held in.** Local currencies exist at
 * exactly two edges — what a user pays when funding, and what they are paid
 * when withdrawing — plus display. Nothing in between is stored locally.
 *
 * So the base amount is authoritative and the local amount is an illustration:
 * compare, validate and sum on the base figure, never on the local one, and
 * never send a local amount back to the server.
 */

/**
 * `official` is live market data; `system` is the platform's own configured
 * rate, used when the provider is unreachable or an admin has pinned rates.
 */
export type RateSource = 'official' | 'system';

export interface SupportedCurrency {
  countryId: number;
  country: string;
  currency: string;
  /** Units per 1 USD. Null when no rate could be established. */
  rate: number | null;
  /** What actually priced *this* currency, which can differ from the
   * platform-wide `CurrencyIndex.source` during a provider outage. */
  rateSource: RateSource;
  /**
   * The only thing that may gate a currency in the UI. A currency can be
   * supported but temporarily unpriced, and offering it would misprice a
   * payment.
   */
  fundable: boolean;
}

export interface CurrencyIndex {
  /** Settlement currency. Always USD. */
  base: string;
  /** What the admin selected platform-wide. */
  source: RateSource;
  supported: SupportedCurrency[];
  /**
   * The caller's own currency, resolved server-side from their profile
   * address. Never ask the user to pick one while this is non-null.
   */
  mine: string | null;
}

/**
 * The converted twin of a money object. Its amount keys mirror the base
 * object's exactly, so one formatter can walk both with the same accessor.
 *
 * Modelled as `| null` at every use site rather than optional, so the compiler
 * forces the null branch — which is the branch people forget, and the common
 * case for a user with no country on file.
 */
export type LocalBlock<K extends string> = {
  currency: string;
  country: string;
  rate: number;
  rateSource: RateSource;
} & Record<K, number | null>;
