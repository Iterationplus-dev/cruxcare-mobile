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
/** Longer than the 30-day minimum, so the plan splits 70/30. */
const PLAN_MINOR = 20000;
const PRODUCT_MINOR = 2500;

function seededCase() {
  const found = caseFiles.find((c) => c.caseId === CASE_ID);
  if (!found) throw new Error(`fixture ${CASE_ID} is gone`);
  return found;
}

describe('what the client owes today', () => {
  beforeEach(async () => {
    const file = seededCase();
    file.treatmentPlan = {
      planId: 'plan-weekly',
      cadence: 'weekly',
      startDate: '2026-08-01',
      endDate: '2026-11-01',
      summary: 'Shoulder rehabilitation',
      proposedAt: '2026-07-28T09:00:00Z',
      agreedAt: '2026-07-29T09:00:00Z',
    };
    file.subscription = {
      id: 'sub-bill-1',
      planId: 'plan-weekly',
      caseId: CASE_ID,
      cadence: 'weekly',
      status: 'active',
      visitsTotal: 12,
      visitsUsed: 0,
      visitsRemaining: 12,
      startedAt: '2026-08-01T09:00:00Z',
      renewsAt: null,
      endsAt: '2026-11-01',
      rolloverEndsAt: null,
      amountMinor: PLAN_MINOR,
      currency: 'USD',
    };
    file.recommendations = [
      {
        id: 'rec-bill-1',
        productId: 'prod-1',
        productName: 'CARE BLOOD ACTIVATOR',
        quantity: 1,
        unitPrice: PRODUCT_MINOR / 100,
        unitPriceMinor: PRODUCT_MINOR,
        total: PRODUCT_MINOR / 100,
        totalMinor: PRODUCT_MINOR,
        currency: 'USD',
        note: null,
        status: 'accepted',
        paidMinor: 0,
        removable: true,
        recommendedAt: '2026-08-02T09:00:00Z',
        respondedAt: '2026-08-03T09:00:00Z',
      },
    ];

    setActivePinia(createPinia());
    await useAuthStore().login(demoCredentials.identifier, demoCredentials.password);
  });

  it('is the instalment due now plus the goods, not the whole balance', async () => {
    const bill = await casesApi.bill(CASE_ID);

    const deposit = Math.round(PLAN_MINOR * 0.7);
    // The 30% balance is not due yet, so it is deliberately excluded — that is
    // the whole difference between this button and "pay everything".
    expect(bill.payment?.dueNowWithProductsMinor).toBe(deposit + PRODUCT_MINOR);
    expect(bill.outstandingMinor).toBe(PLAN_MINOR + PRODUCT_MINOR);
    expect(bill.payment?.dueNowWithProductsMinor).toBeLessThan(bill.outstandingMinor);
  });

  it('marks an unpaid product as still removable by the therapist', async () => {
    const bill = await casesApi.bill(CASE_ID);

    expect(bill.products[0].paidMinor).toBe(0);
    expect(bill.products[0].removable).toBe(true);
  });

  it('refuses to let the therapist delete a product the client has paid for', async () => {
    // Removing a paid line is a refund, not a delete — a different operation
    // with money in it, and not one a Remove button should perform quietly.
    seededCase().recommendations[0].paidMinor = PRODUCT_MINOR;

    await expect(casesApi.removeRecommendation(CASE_ID, 'rec-bill-1')).rejects.toMatchObject({
      status: 409,
      code: 'recommendation_already_paid',
    });
    // And it is still there afterwards.
    expect(seededCase().recommendations).toHaveLength(1);
  });
});
