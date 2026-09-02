import type { TherapistPlanTier } from '@/types/user';

/**
 * The therapist plan catalogue.
 *
 * `priceMinor` mirrors `subscription_plans.price`. The server re-derives what
 * it actually charges from its own row, so this only drives what the UI offers
 * and what it labels a plan — it is never the source of a charge.
 *
 * Lifted out of the plan screen because the profile shows the price too, and
 * two hardcoded copies of a price is one more than can be kept honest. There is
 * no plans endpoint yet; when there is, this is the one place to replace.
 */
export interface TherapistPlan {
  key: TherapistPlanTier;
  name: string;
  /** Display string, e.g. `$15/mo`. */
  price: string;
  priceMinor: number;
  detail: string;
  tag?: string;
}

export const therapistPlans: TherapistPlan[] = [
  {
    key: 'free-trial',
    name: 'Free trial',
    price: '$0',
    priceMinor: 0,
    detail: '1 client · 1 case file · unlimited purchases',
  },
  {
    key: 'monthly',
    name: 'Monthly',
    price: '$15/mo',
    priceMinor: 1500,
    detail: '25 clients · unlimited case files · Point Facility hosting',
    tag: 'MOST CHOSEN',
  },
  {
    key: 'yearly',
    name: 'Yearly',
    price: '$200/yr',
    priceMinor: 20000,
    detail: 'Everything monthly · save $40 · priority assignment',
  },
];

export function findPlan(key: TherapistPlanTier | null | undefined): TherapistPlan | null {
  if (!key) return null;
  return therapistPlans.find((p) => p.key === key) ?? null;
}

/**
 * `Monthly · $15/mo`, or just the name when the plan is free.
 *
 * Null when there is no plan to describe — an account that never subscribed
 * shows no price rather than `$0`, which would read as a plan they are on.
 */
export function planWithPrice(key: TherapistPlanTier | null | undefined): string | null {
  const plan = findPlan(key);
  if (!plan) return null;
  return plan.priceMinor > 0 ? `${plan.name} · ${plan.price}` : plan.name;
}
