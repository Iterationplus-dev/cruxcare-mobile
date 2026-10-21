/**
 * The one place an amount becomes a string. Everything that renders money —
 * `MoneyAmount`, button labels, sheet copy — goes through here so a currency
 * is never assumed and a symbol is never hard-coded.
 *
 * The currency argument always comes from the API response that carried the
 * amount (`wallet.currency`, `quote.local.currency`, `intent.currency`). Since
 * wallets can now be funded and paid out in a user's own currency, a literal
 * symbol anywhere would eventually sit against the wrong number.
 */

/**
 * Currencies render with their own symbol only under a locale that knows them:
 * `en-US` prints NGN as "NGN 1,234.50", while `en-NG` prints "₦1,234.50" but
 * demotes USD to "US$". Picking the locale from the currency gets the right
 * symbol in both directions. Anything unlisted falls back to `en-US`, which
 * prints the ISO code — correct, just not pretty.
 */
const LOCALE_BY_CURRENCY: Record<string, string> = {
  USD: 'en-US',
  NGN: 'en-NG',
  GHS: 'en-GH',
  XAF: 'fr-CM',
  EUR: 'de-DE',
  GBP: 'en-GB',
};

export interface FormatMoneyOptions {
  /** Renders `+`/`-` for anything other than zero — used by ledger rows. */
  showSign?: boolean;
  /** Overrides the currency-derived locale. */
  locale?: string;
}

export function formatMoney(
  amount: number,
  currency: string,
  options: FormatMoneyOptions = {},
): string {
  const locale = options.locale ?? localeFor(currency);

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      // Deliberately not pinned to 2: XAF has no minor unit, and forcing
      // decimals onto it would invent a precision the currency does not have.
      signDisplay: options.showSign ? 'exceptZero' : 'auto',
    }).format(amount);
  } catch {
    // An unknown or malformed ISO code makes Intl throw. A readable fallback
    // beats a blank screen where a balance should be.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function localeFor(currency: string): string {
  return LOCALE_BY_CURRENCY[currency?.toUpperCase()] ?? 'en-US';
}

/**
 * Renders an amount the API published in minor units.
 *
 * The case bill publishes every figure twice — `total` and `totalMinor` — and
 * only the minor one is safe to compute on: JSON renders a whole float as a
 * bare integer, so a `total` of 210.0 arrives as `210` and cannot be told from
 * minor units by looking at it. Do the arithmetic in minor, convert once here.
 */
export function formatMinor(
  amountMinor: number,
  currency: string,
  options: FormatMoneyOptions = {},
): string {
  return formatMoney(amountMinor / 100, currency, options);
}
