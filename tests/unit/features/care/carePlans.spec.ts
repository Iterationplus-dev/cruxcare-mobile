import { describe, expect, it } from 'vitest';
import { planPrice, planSubtitle, subscriptionSummary } from '@/features/care/carePlans';
import type { CarePlanOption, CareSubscription } from '@/types/care';

const option = (over: Partial<CarePlanOption> = {}): CarePlanOption => ({
  id: 'plan-twice-3m',
  cadence: 'twice-weekly',
  title: '2 visits a week',
  durationLabel: '3 months',
  visits: 24,
  durationDays: 90,
  amountMinor: 21000,
  perVisitMinor: 875,
  currency: 'USD',
  recommended: true,
  ...over,
});

const subscription = (over: Partial<CareSubscription> = {}): CareSubscription => ({
  id: 'sub-1',
  planId: 'plan-twice-3m',
  caseId: 'case-1',
  cadence: 'twice-weekly',
  status: 'active',
  visitsTotal: 24,
  visitsUsed: 6,
  visitsRemaining: 18,
  startedAt: '2026-08-01T00:00:00Z',
  renewsAt: '2026-11-01T00:00:00Z',
  endsAt: '2026-11-01T00:00:00Z',
  rolloverEndsAt: '2026-12-01T00:00:00Z',
  amountMinor: 21000,
  currency: 'USD',
  ...over,
});

describe('planSubtitle', () => {
  it('builds the drawn line from the server figures', () => {
    expect(planSubtitle(option())).toBe('3 months · 24 visits · $8.75 a visit');
  });

  it('omits the per-visit figure rather than dividing for one', () => {
    // Dividing here would put a number on screen the server never agreed to,
    // and the rounding would drift from whatever it charges.
    const line = planSubtitle(option({ perVisitMinor: null }));

    expect(line).toBe('3 months · 24 visits');
    expect(line).not.toMatch(/a visit/);
  });

  it('prices from minor units, not from a pre-formatted string', () => {
    expect(planPrice(option())).toBe('$210.00');
  });
});

describe('subscriptionSummary', () => {
  it('says nothing at all when there is no plan', () => {
    expect(subscriptionSummary(null)).toBeNull();
    expect(subscriptionSummary(undefined)).toBeNull();
  });

  it('leads with the balance and names the renewal date', () => {
    const summary = subscriptionSummary(subscription());

    expect(summary?.visits).toBe('18 of 24 visits left');
    expect(summary?.renewal).toMatch(/Renews 1 Nov 2026/);
    expect(summary?.tone).toBe('normal');
  });

  it('omits renewal rather than inventing one from an absent date', () => {
    const summary = subscriptionSummary(subscription({ renewsAt: null }));

    expect(summary?.renewal).toBeNull();
  });

  it('mentions rollover only once the visits are actually spent', () => {
    const running = subscriptionSummary(subscription());
    const spent = subscriptionSummary(subscription({ visitsRemaining: 0, visitsUsed: 24 }));

    expect(running?.rollover).toBeNull();
    expect(spent?.rollover).toMatch(/roll over until 1 Dec 2026/);
    expect(spent?.tone).toBe('warning');
  });

  it('tells a cancellation from an expiry, since they are different facts', () => {
    const cancelled = subscriptionSummary(subscription({ status: 'cancelled' }));
    const lapsed = subscriptionSummary(subscription({ status: 'lapsed' }));

    expect(cancelled?.renewal).toMatch(/usable until/i);
    expect(lapsed?.renewal).toMatch(/has ended/i);
    expect(cancelled?.tone).toBe('warning');
    expect(lapsed?.tone).toBe('warning');
  });

  it('marks an unpaid plan as unpaid rather than as active', () => {
    const summary = subscriptionSummary(subscription({ status: 'awaiting-payment' }));

    expect(summary?.renewal).toMatch(/not paid for/i);
    expect(summary?.tone).toBe('warning');
  });
});
