import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { casesApi } from '@/api/cases.api';
import { useAuthStore } from '@/stores/auth';
import { caseFiles, demoCredentials } from '@/mocks/db';

vi.mock('@/services/secureStorage', () => ({
  secureStorage: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  SECURE_STORAGE_KEYS: { authToken: 'cc_auth_token', pushInstallationId: 'cc_push_id' },
}));

const CASE_ID = 'case-record-1';

function seededCase() {
  const found = caseFiles.find((c) => c.caseId === CASE_ID);
  if (!found) throw new Error(`fixture ${CASE_ID} is gone`);
  return found;
}

async function signIn() {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  await auth.login(demoCredentials.identifier, demoCredentials.password);
  return auth;
}

describe('progress reports', () => {
  beforeEach(async () => {
    const file = seededCase();
    file.progressReports = [];
    file.treatmentExtensions = [];
    file.treatmentStartedAt = null;
    await signIn();
  });

  it('refuses an entry before treatment has started', async () => {
    // Nothing to report on yet, and an entry dated before the first session
    // would make the record say something untrue.
    await expect(
      casesApi.addProgressReport(CASE_ID, {
        condition: 'Doing well',
        trend: 'improving',
        recordedFor: '2026-09-15',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'treatment_not_started' });
  });

  it('refuses an entry with no account of how the client is doing', async () => {
    seededCase().treatmentStartedAt = '2026-09-01T09:00:00Z';

    await expect(
      casesApi.addProgressReport(CASE_ID, {
        condition: '   ',
        trend: 'improving',
        recordedFor: '2026-09-15',
      }),
    ).rejects.toMatchObject({ status: 422, code: 'condition_required' });
  });

  it('records the condition, what was administered and what was done', async () => {
    seededCase().treatmentStartedAt = '2026-09-01T09:00:00Z';

    const report = await casesApi.addProgressReport(CASE_ID, {
      condition: 'Rotation pain down from 7 to 4.',
      productsAdministered: 'Care Blood Activator, one sachet topically.',
      techniques: 'Deep tissue work, 20 minutes.',
      trend: 'improving',
      recordedFor: '2026-09-12',
    });

    expect(report.condition).toBe('Rotation pain down from 7 to 4.');
    expect(report.productsAdministered).toContain('Care Blood Activator');
    expect(report.techniques).toContain('Deep tissue');
    expect(report.trend).toBe('improving');
    // The day reported on, not the day it was typed up.
    expect(report.recordedFor).toBe('2026-09-12');
    expect(seededCase().progressReports?.[0]?.id).toBe(report.id);
  });

  it('leaves the optional fields null rather than storing empty strings', async () => {
    seededCase().treatmentStartedAt = '2026-09-01T09:00:00Z';

    const report = await casesApi.addProgressReport(CASE_ID, {
      condition: 'Unchanged since last week.',
      productsAdministered: '   ',
      techniques: '',
      trend: 'unchanged',
      recordedFor: '2026-09-15',
    });

    // A session where nothing was administered is a real session; writing
    // "none" to satisfy a form is how a clinical record fills up with noise.
    expect(report.productsAdministered).toBeNull();
    expect(report.techniques).toBeNull();
  });
});

describe('extending treatment', () => {
  beforeEach(async () => {
    const file = seededCase();
    file.progressReports = [];
    file.treatmentExtensions = [];
    file.treatmentPlan = {
      planId: 'plan-weekly',
      cadence: 'weekly',
      startDate: '2026-08-01',
      endDate: '2026-10-01',
      summary: 'Shoulder rehabilitation',
      proposedAt: '2026-07-28T09:00:00Z',
      agreedAt: '2026-07-29T09:00:00Z',
    };
    // The seeded case has no paid plan, and visits only exist on one — so the
    // extension tests put one there rather than asserting against null.
    file.subscription = {
      id: 'sub-test-1',
      planId: 'plan-weekly',
      caseId: CASE_ID,
      cadence: 'weekly',
      status: 'active',
      visitsTotal: 8,
      visitsUsed: 3,
      visitsRemaining: 5,
      startedAt: '2026-08-01T09:00:00Z',
      renewsAt: null,
      endsAt: '2026-10-01',
      rolloverEndsAt: null,
      amountMinor: 20000,
      currency: 'USD',
    };
    await signIn();
  });

  it('refuses an extension nobody justified', async () => {
    await expect(
      casesApi.extendTreatment(CASE_ID, {
        endDate: '2026-11-01',
        addedVisits: 4,
        reason: '  ',
      }),
    ).rejects.toMatchObject({ status: 422, code: 'reason_required' });
  });

  it('refuses an end date that is not later than the current one', async () => {
    // Shortening a window is a different operation with different
    // consequences, and this is not it.
    await expect(
      casesApi.extendTreatment(CASE_ID, {
        endDate: '2026-09-01',
        addedVisits: 0,
        reason: 'Client is not better yet.',
      }),
    ).rejects.toMatchObject({ status: 422, code: 'end_date_not_later' });
  });

  it('applies more time on the same visits straight away', async () => {
    const totalBefore = seededCase().subscription?.visitsTotal;

    const updated = await casesApi.extendTreatment(CASE_ID, {
      endDate: '2026-12-01',
      addedVisits: 0,
      reason: 'They travel in October; same sessions, longer window.',
    });

    // The window is the therapist's to set, so more time costs nothing and
    // needs nobody's agreement.
    expect(updated.treatmentPlan?.endDate).toBe('2026-12-01');
    expect(updated.subscription?.visitsTotal).toBe(totalBefore);
    const [extension] = updated.treatmentExtensions ?? [];
    expect(extension.status).toBe('applied');
    expect(extension.planId).toBeNull();
    expect(extension.amountMinor).toBe(0);
    // The old end date is kept: "this course ran twice as long as planned" is
    // clinically meaningful, and an overwritten date erases it.
    expect(extension.previousEndDate).toBe('2026-10-01');
  });

  it('holds extra visits as an offer, changing nothing until they are paid for', async () => {
    const before = seededCase().subscription!;
    const totalBefore = before.visitsTotal;

    const updated = await casesApi.extendTreatment(CASE_ID, {
      endDate: '2026-11-01',
      addedVisits: 4,
      reason: 'Recovery on track but slower than planned.',
    });

    const [extension] = updated.treatmentExtensions ?? [];
    expect(extension.status).toBe('awaiting-payment');
    // Priced at the plan's own per-visit rate: 20000 over 8 visits.
    expect(extension.amountMinor).toBe(10000);
    expect(extension.planId).not.toBeNull();
    expect(extension.appliedAt).toBeNull();

    // The whole point of option (b): an offer is not a fact. Reporting either
    // of these as changed would tell the therapist the client can book
    // sessions they have not bought.
    expect(updated.treatmentPlan?.endDate).toBe('2026-10-01');
    expect(updated.subscription?.visitsTotal).toBe(totalBefore);
  });

  it('bills a pending offer apart from treatment, and not as debt', async () => {
    await casesApi.extendTreatment(CASE_ID, {
      endDate: '2026-11-01',
      addedVisits: 4,
      reason: 'Slower than planned.',
    });

    const bill = await casesApi.bill(CASE_ID);

    expect(bill.payment?.extensionsOutstandingMinor).toBe(10000);
    // Folding it into treatment would re-price a deposit already paid, and an
    // offer nobody has accepted is not owed.
    expect(bill.treatmentTotalMinor).toBe(20000);
  });

  it('refuses a second offer while one is still waiting', async () => {
    await casesApi.extendTreatment(CASE_ID, {
      endDate: '2026-11-01',
      addedVisits: 4,
      reason: 'Slower than planned.',
    });

    // Two payable top-ups would leave no answer to which end date won.
    await expect(
      casesApi.extendTreatment(CASE_ID, {
        endDate: '2026-12-01',
        addedVisits: 2,
        reason: 'Slower still.',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'extension_awaiting_payment' });
  });

  it('lets the therapist take an unpaid offer back, and keeps the record of it', async () => {
    const offered = await casesApi.extendTreatment(CASE_ID, {
      endDate: '2026-11-01',
      addedVisits: 4,
      reason: 'Slower than planned.',
    });
    const [extension] = offered.treatmentExtensions ?? [];

    const updated = await casesApi.withdrawExtension(CASE_ID, extension.id);

    // Kept rather than deleted: "we offered four more sessions and they did
    // not take them" is a fact about the course of treatment.
    expect(updated.treatmentExtensions?.[0].status).toBe('withdrawn');
    expect(updated.treatmentExtensions).toHaveLength(1);

    // And the case can be extended again, which is the whole reason the route
    // exists — a client who never pays would otherwise block it forever.
    await expect(
      casesApi.extendTreatment(CASE_ID, {
        endDate: '2026-12-01',
        addedVisits: 2,
        reason: 'Trying again with fewer sessions.',
      }),
    ).resolves.toBeTruthy();
  });
});
