import type { TherapistPlanTier } from '@/types/user';
import { formatMoney } from '@/utils/money';

/**
 * A plan as `GET /therapist/plans` returns it.
 *
 * `amountMinor` is the same integer the activation charges, and
 * `clientLimit`/`caseFileLimit` are the limits the server actually enforces —
 * so a plan screen and the refusal at accept time cannot disagree.
 *
 * This replaced a hardcoded array in the app. A client-side price is milder
 * than a client-side charge and still wrong: it drifts the day somebody edits
 * `subscription_plans`, and nothing compares the two.
 */
export interface TherapistPlanOption {
  key: TherapistPlanTier;
  name: string;
  amountMinor: number;
  currency: string;
  billingCycle: string;
  durationDays: number;
  isTrial: boolean;
  recommended: boolean;
  /** Null means unlimited. */
  clientLimit: number | null;
  caseFileLimit: number | null;
}

/** `$15/mo`. Empty for a free plan — `$0` reads as a price someone is paying. */
export function planPrice(plan: TherapistPlanOption | null | undefined): string {
  if (!plan || plan.amountMinor <= 0) return '';

  const amount = formatMoney(plan.amountMinor / 100, plan.currency);
  const suffix =
    plan.billingCycle === 'monthly' ? '/mo' : plan.billingCycle === 'yearly' ? '/yr' : '';

  return `${amount}${suffix}`;
}

export function findPlan(
  plans: TherapistPlanOption[] | undefined,
  key: TherapistPlanTier | null | undefined,
): TherapistPlanOption | null {
  if (!plans || !key) return null;
  return plans.find((p) => p.key === key) ?? null;
}

/** What a plan allows, in the server's own numbers. Null limits are unlimited. */
export function planLimits(plan: TherapistPlanOption): string {
  const clients = plan.clientLimit === null ? 'Unlimited clients' : `${plan.clientLimit} client${plan.clientLimit === 1 ? '' : 's'}`;
  const files =
    plan.caseFileLimit === null
      ? 'unlimited case files'
      : `${plan.caseFileLimit} case file${plan.caseFileLimit === 1 ? '' : 's'}`;
  return `${clients} · ${files}`;
}
