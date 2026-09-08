import { describe, expect, it } from 'vitest';
import {
  canEditTreatmentPlan,
  canScheduleSessions,
  caseStage,
} from '@/features/therapist/caseStage';
import type { CaseFile, CareSubscription, TreatmentPlan } from '@/types/care';

const day = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * day).toISOString();

const plan = (over: Partial<TreatmentPlan> = {}): TreatmentPlan => ({
  planId: 'plan-twice-3m',
  cadence: 'twice-weekly',
  startDate: iso(-7),
  endDate: iso(30),
  summary: 'Twelve weeks of mobility work.',
  proposedAt: iso(-8),
  agreedAt: iso(-7),
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
  startedAt: iso(-7),
  renewsAt: iso(30),
  endsAt: iso(30),
  rolloverEndsAt: iso(60),
  amountMinor: 21000,
  currency: 'USD',
  ...over,
});

const file = (over: Partial<CaseFile> = {}): CaseFile => ({
  id: 'case-1',
  clientId: 'user-1',
  therapistId: 'therapist-1',
  notes: [],
  recommendations: [],
  status: 'active',
  ...over,
});

describe('caseStage', () => {
  it('walks the flow in order as each thing is recorded', () => {
    expect(caseStage(file()).stage).toBe('assessment');

    const diagnosed = file({ diagnosis: 'Lumbar strain' });
    expect(caseStage(diagnosed).stage).toBe('planning');

    const planned = file({ ...diagnosed, treatmentPlan: plan() });
    expect(caseStage(planned).stage).toBe('awaiting-payment');

    const paid = file({ ...planned, subscription: subscription() });
    expect(caseStage(paid).stage).toBe('ready-to-start');

    const started = file({ ...paid, treatmentStartedAt: iso(-6) });
    expect(caseStage(started).stage).toBe('in-treatment');
  });

  it('never claims treatment is under way on an unpaid plan', () => {
    // The one invariant worth stating outright: a start date recorded against
    // an unpaid plan would let sessions be booked against visits nobody bought.
    const unpaid = file({
      diagnosis: 'Lumbar strain',
      treatmentPlan: plan(),
      subscription: null,
      treatmentStartedAt: iso(-2),
    });

    const stage = caseStage(unpaid);

    expect(stage.stage).toBe('awaiting-payment');
    expect(canScheduleSessions(unpaid)).toBe(false);
  });

  it('offers the therapist nothing to do while it waits on the client', () => {
    const awaiting = file({ diagnosis: 'Lumbar strain', treatmentPlan: plan() });

    expect(caseStage(awaiting).waitingOn).toBe('client');
  });

  it('reaches follow-up from a spent window and from spent visits, and says which', () => {
    const base = {
      diagnosis: 'Lumbar strain',
      subscription: subscription(),
      treatmentStartedAt: iso(-40),
    };

    const windowOver = caseStage(file({ ...base, treatmentPlan: plan({ endDate: iso(-1) }) }));
    const visitsGone = caseStage(
      file({
        ...base,
        treatmentPlan: plan(),
        subscription: subscription({ visitsRemaining: 0, visitsUsed: 24 }),
      }),
    );

    expect(windowOver.stage).toBe('follow-up');
    expect(windowOver.detail).toMatch(/window has ended/i);
    expect(visitsGone.stage).toBe('follow-up');
    expect(visitsGone.detail).toMatch(/every visit/i);
  });

  it('treats a window ending today as still running', () => {
    const endingToday = file({
      diagnosis: 'Lumbar strain',
      treatmentPlan: plan({ endDate: new Date().toISOString() }),
      subscription: subscription(),
      treatmentStartedAt: iso(-10),
    });

    expect(caseStage(endingToday).stage).toBe('in-treatment');
  });

  it('reads a lapsed plan as needing payment, not as a closed case', () => {
    const lapsed = file({
      diagnosis: 'Lumbar strain',
      treatmentPlan: plan(),
      subscription: subscription({ status: 'lapsed' }),
      treatmentStartedAt: iso(-40),
    });

    const stage = caseStage(lapsed);

    expect(stage.stage).toBe('awaiting-payment');
    expect(stage.waitingOn).toBe('client');
    expect(stage.label).toMatch(/expired/i);
  });

  it('closes on the case status whatever else is recorded', () => {
    const closed = file({
      status: 'Closed',
      diagnosis: 'Lumbar strain',
      treatmentPlan: plan(),
      subscription: subscription(),
      treatmentStartedAt: iso(-40),
      closingSummary: 'Full range of movement restored.',
    });

    const stage = caseStage(closed);

    expect(stage.stage).toBe('closed');
    expect(stage.detail).toContain('Full range of movement restored.');
    expect(canScheduleSessions(closed)).toBe(false);
  });

  it('will not let a paid plan be edited underneath the client', () => {
    const paid = file({
      diagnosis: 'Lumbar strain',
      treatmentPlan: plan(),
      subscription: subscription(),
      treatmentStartedAt: iso(-2),
    });

    expect(canEditTreatmentPlan(paid)).toBe(false);
    expect(canEditTreatmentPlan(file({ diagnosis: 'Lumbar strain' }))).toBe(true);
  });
});
