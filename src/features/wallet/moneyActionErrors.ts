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

  /**
   * The purse has a floor and the *balance* has not reached it — not the
   * request. Someone sitting on $120 may take $20 of it; someone on $80 may
   * take nothing, however little they ask for.
   */
  if (error.code === 'loyalty_minimum_not_met') {
    const required = figure(error.meta, 'required');
    const available = figure(error.meta, 'available');
    const title = 'Your loyalty wallet is not open yet';

    if (required === null || available === null || !currency) {
      return { title, message: error.message };
    }
    return {
      title,
      message:
        `Loyalty opens at ${formatMoney(required, currency)}. ` +
        `You have ${formatMoney(available, currency)} — it keeps building as you earn.`,
    };
  }

  /**
   * Money is there, it is just not clear yet. Saying "insufficient funds" to
   * somebody looking at a figure on their own screen is how a correct refusal
   * becomes a support ticket, so the pending amount is named.
   */
  if (error.code === 'insufficient_funds') {
    const pending = figure(error.meta, 'pending');
    const title = 'Not enough cleared yet';

    if (pending === null || pending <= 0 || !currency) {
      return { title: 'Not enough in that wallet', message: error.message };
    }
    return {
      title,
      message:
        `${formatMoney(pending, currency)} is still clearing — it becomes available once your ` +
        'client has finished paying for their course.',
    };
  }

  /**
   * Asked to withdraw from a purse that does not pay out. Not a limit the user
   * can wait out, so it does not offer to try again later.
   */
  if (error.code === 'wallet_not_withdrawable') {
    return {
      title: 'That wallet does not pay out',
      message: error.message,
    };
  }

  return null;
}

/**
 * The withdrawal window is shut.
 *
 * Kept apart from `moneyRefusal` because it is not a refusal about the money:
 * nothing is wrong with the amount or the balance, it is simply the wrong day.
 * It is also checked twice — once when the quote is minted and again when the
 * action settles, so a quote taken at 23:58 on Friday cannot pay out on
 * Saturday — and both calls route through here.
 */
export function withdrawalWindowRefusal(error: unknown): MoneyRefusal | null {
  if (!(error instanceof ApiError) || error.code !== 'withdrawal_window_closed') return null;
  return {
    title: 'Withdrawals are closed right now',
    // The server's own sentence: it knows the days, and they are configuration
    // rather than something to restate here and let drift.
    message: error.message,
  };
}
