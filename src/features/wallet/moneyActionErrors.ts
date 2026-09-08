import { ApiError } from '@/types/api';
import { formatMoney } from '@/utils/money';

export interface MoneyRefusal {
  title: string;
  message: string;
}

function figure(meta: Record<string, unknown> | undefined, key: string): number | null {
  const value = meta?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function currencyOf(meta: Record<string, unknown> | undefined): string | null {
  const value = meta?.currency;
  // Server-configured and different per environment, so never assumed.
  return typeof value === 'string' && value.length === 3 ? value : null;
}

/**
 * A money write refused for a rule the member can act on, told with the
 * figures behind it. Anything else — a dropped connection, an expired quote,
 * a server failure — returns null and is reported the ordinary way.
 *
 * The server's own `message` is the fallback throughout: it is written for a
 * person, and it is more useful than our copy when the figures are missing.
 * Both rules are checked at quote time and again at settlement, so both calls
 * pass their error through here.
 */
export function moneyRefusal(error: unknown): MoneyRefusal | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null;

  const currency = currencyOf(error.meta);

  if (error.code === 'withdrawal_threshold_not_met') {
    const required = figure(error.meta, 'required');
    const available = figure(error.meta, 'available');
    const title = 'Not enough in your wallet yet';

    if (required === null || available === null || !currency) {
      return { title, message: error.message };
    }
    return {
      title,
      message:
        `Your wallet needs to reach ${formatMoney(required, currency)} before you can withdraw. ` +
        `You have ${formatMoney(available, currency)}.`,
    };
  }

  if (error.code === 'daily_limit_exceeded') {
    const limit = figure(error.meta, 'limit');
    const usedToday = figure(error.meta, 'usedToday');
    const title = "That is over today's limit";

    if (limit === null || usedToday === null || !currency) {
      return { title, message: error.message };
    }
    return {
      title,
      message:
        `You can move ${formatMoney(limit, currency)} a day. ` +
        `You have already moved ${formatMoney(usedToday, currency)} today — try again tomorrow, ` +
        'or for a smaller amount.',
    };
  }

  return null;
}
