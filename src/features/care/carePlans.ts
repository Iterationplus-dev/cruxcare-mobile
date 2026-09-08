import { formatMoney } from '@/utils/money';
import type { CarePlanOption, CareSubscription } from '@/types/care';

/**
 * The second line of a plan card: "3 months · 24 visits · $8.75 a visit".
 *
 * The per-visit figure is only shown when the server sent one. Dividing the
 * price here would put a number on screen that the server never agreed to, and
 * the rounding would drift from whatever it charges.
 */
export function planSubtitle(option: CarePlanOption): string {
  const parts = [option.durationLabel, `${option.visits} visits`];
  if (option.perVisitMinor !== null) {
    parts.push(`${formatMoney(option.perVisitMinor / 100, option.currency)} a visit`);
  }
  return parts.join(' · ');
}

export function planPrice(option: CarePlanOption): string {
  return formatMoney(option.amountMinor / 100, option.currency);
}

export interface SubscriptionSummary {
  /** "18 of 24 visits left" — the balance, not a percentage of nothing. */
  visits: string;
  /** Null when there is nothing true to say about renewal. */
  renewal: string | null;
  /** Whether unused visits are inside their 30-day rollover. */
  rollover: string | null;
  tone: 'normal' | 'warning';
}

/**
 * What a client's own plan says about itself on the care hub.
 *
 * Every line is omitted rather than guessed at: a plan with no renewal date is
 * shown without one, because "renews soon" invents a fact from an absence.
 */
export function subscriptionSummary(
  subscription: CareSubscription | null | undefined,
): SubscriptionSummary | null {
  if (!subscription) return null;

  const visits = `${subscription.visitsRemaining} of ${subscription.visitsTotal} visits left`;
  const exhausted = subscription.visitsRemaining <= 0;

  if (subscription.status === 'lapsed') {
    return { visits, renewal: 'This plan has ended.', rollover: null, tone: 'warning' };
  }
  if (subscription.status === 'cancelled') {
    return {
      visits,
      renewal: subscription.endsAt
        ? `Cancelled — usable until ${formatDay(subscription.endsAt)}.`
        : 'Cancelled — no further payments will be taken.',
      rollover: null,
      tone: 'warning',
    };
  }
  if (subscription.status === 'awaiting-payment') {
    return { visits, renewal: 'Not paid for yet.', rollover: null, tone: 'warning' };
  }

  return {
    visits,
    renewal: subscription.renewsAt ? `Renews ${formatDay(subscription.renewsAt)}` : null,
    rollover:
      exhausted && subscription.rolloverEndsAt
        ? `Unused visits roll over until ${formatDay(subscription.rolloverEndsAt)}.`
        : null,
    tone: exhausted ? 'warning' : 'normal',
  };
}

function formatDay(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
