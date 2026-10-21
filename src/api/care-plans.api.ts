import { apiClient, idempotencyHeader, newIdempotencyKey } from './client';
import type { CarePlanOption, CareSubscription } from '@/types/care';

/**
 * The client's care plan: the cadence catalogue (D2b) and the subscription it
 * turns into.
 *
 * Prices are never assembled here. The catalogue carries `amountMinor` and
 * `perVisitMinor` as the server computed them, and subscribing sends the
 * amount that was on screen so a stale price is refused rather than charged.
 */
export const carePlansApi = {
  /**
   * Cadences offered for one case. Scoped to the case rather than global,
   * because what a therapist proposed is part of the offer — a client should
   * not be shown four options when their therapist has recommended one.
   */
  async list(caseId: string): Promise<CarePlanOption[]> {
    const { data } = await apiClient.get<{ data: CarePlanOption[] }>('/care/plans', {
      params: { caseId },
    });
    return data.data;
  },

  /** Wrapped in `data` like every other read, and `null` inside it is the
   *  answer for "no plan yet" — never a 404, which would be an error for a
   *  state that is perfectly ordinary. */
  async subscription(caseId: string): Promise<CareSubscription | null> {
    const { data } = await apiClient.get<{ data: CareSubscription | null }>(
      '/care/subscriptions/current',
      { params: { caseId } },
    );
    return data.data;
  },

  /**
   * Takes the plan. A money write, so it carries an idempotency key: a retry
   * after a dropped response must not open a second subscription.
   *
   * `paymentToken` is the reference from a settled payment intent. The server
   * verifies it with the gateway — holding one is not proof of payment.
   */
  async subscribe(payload: {
    caseId: string;
    planId: string;
    paymentToken: string;
    expectedAmountMinor: number;
    expectedCurrency: string;
  }): Promise<CareSubscription> {
    const { data } = await apiClient.post<CareSubscription>(
      '/care/subscriptions',
      payload,
      idempotencyHeader(newIdempotencyKey()),
    );
    return data;
  },

  /** Stops it renewing. Visits already paid for stay usable to the end of the
   *  cycle, which is why this is not the same as ending the plan today. */
  async cancel(subscriptionId: string): Promise<CareSubscription> {
    const { data } = await apiClient.post<CareSubscription>(
      `/care/subscriptions/${subscriptionId}/cancel`,
    );
    return data;
  },
};
