import { apiClient } from './client';
import type {
  CaseBill,
  CaseFile,
  CaseFileRecommendation,
  CaseProgressReport,
  CaseRecommendations,
  ProgressTrend,
  TreatmentPlan,
} from '@/types/care';

export interface ProposeTreatmentPlanPayload {
  planId: string | null;
  cadence: string;
  startDate: string;
  endDate: string;
  summary: string;
  /**
   * Only for `cadence: 'custom'`, where the therapist prices the course
   * themselves. The server stores it as a care plan scoped to this case, so it
   * reaches the client through the ordinary catalogue rather than a quote of
   * its own (backend note §17.3). Bounded server-side against a slipped decimal.
   */
  visits?: number;
  amount?: number;
}

/**
 * The case as a course of treatment, rather than as a folder of notes.
 *
 * Each of these is a transition the therapist makes deliberately, so each is
 * its own route: folding them into `PATCH /case-files/{id}` would make
 * "starting treatment" and "correcting a typo in the diagnosis" the same
 * request, and only one of those is worth an audit entry and a notification.
 */
export interface ProgressReportPayload {
  condition: string;
  productsAdministered?: string | null;
  techniques?: string | null;
  trend: ProgressTrend;
  /** The day being reported on — not always the day it was typed up. */
  recordedFor: string;
}

export interface ExtendTreatmentPayload {
  /** The new end of the window. Must be after the current one. */
  endDate: string;
  /** Zero is valid and means "more time, same visits". */
  addedVisits: number;
  reason: string;
}

export const casesApi = {
  /**
   * Writes the plan the client will be asked to agree to. Proposing again
   * replaces the standing proposal — until it is paid for, at which point it
   * is an agreement and the server refuses (`plan_already_agreed`).
   */
  async proposePlan(caseId: string, payload: ProposeTreatmentPlanPayload): Promise<TreatmentPlan> {
    const { data } = await apiClient.post<TreatmentPlan>(`/cases/${caseId}/plan`, payload);
    return data;
  },

  /**
   * Begins treatment. Refused unless the plan is paid for, because a start
   * date recorded against an unpaid plan would let sessions be scheduled
   * against visits nobody bought.
   */
  async start(caseId: string): Promise<CaseFile> {
    const { data } = await apiClient.post<CaseFile>(`/cases/${caseId}/start`);
    return data;
  },

  /**
   * Adds an entry to the recovery record.
   *
   * Refused before treatment has started (`treatment_not_started`): there is
   * nothing to report on, and an entry dated before the first session would
   * make the record say something untrue.
   *
   * `condition` is required and the other two are not — a session where nothing
   * was administered is a real session, and writing "none" to satisfy a form is
   * how a clinical record fills up with noise.
   */
  async addProgressReport(
    caseId: string,
    payload: ProgressReportPayload,
  ): Promise<CaseProgressReport> {
    const { data } = await apiClient.post<{ data: CaseProgressReport }>(
      `/cases/${caseId}/progress`,
      {
        condition: payload.condition,
        productsAdministered: payload.productsAdministered?.trim() || null,
        techniques: payload.techniques?.trim() || null,
        trend: payload.trend,
        recordedFor: payload.recordedFor,
      },
    );
    return data.data;
  },

  /**
   * Pushes the treatment window out because the client is not better yet.
   *
   * The reason is required for the same purpose a closing summary is: an
   * extension nobody justified is a record nobody can use.
   *
   * `addedVisits` splits the route in two, and this is the whole of the
   * backend's answer on who pays for extra sessions (§2):
   *
   * - **Zero** — more time on the visits they already bought. The window is the
   *   therapist's to set, so it costs nothing and applies at once.
   * - **Above zero** — a purchase. A top-up plan is priced at the current
   *   plan's per-visit rate and the extension comes back `awaiting-payment`.
   *   The end date has *not* moved and `visitsTotal` has *not* changed until
   *   the client buys it, so nothing here may be reported as done.
   */
  async extendTreatment(
    caseId: string,
    payload: ExtendTreatmentPayload,
  ): Promise<CaseFile> {
    const { data } = await apiClient.post<CaseFile>(`/cases/${caseId}/extend`, {
      endDate: payload.endDate,
      addedVisits: payload.addedVisits,
      reason: payload.reason,
    });
    return data;
  },

  /**
   * Takes back an extension the client has not paid for.
   *
   * Needed because a pending offer blocks the next one — `extension_awaiting_payment`
   * — so a client who simply never pays would otherwise leave the case unable
   * to be extended again, ever.
   *
   * Refused with `extension_already_paid` once settled: withdrawing something
   * paid for is a refund, and there is no refund flow. The row survives as
   * `withdrawn` rather than being deleted, because "we offered four more
   * sessions and they did not take them" is a fact about the course.
   */
  async withdrawExtension(caseId: string, extensionId: string): Promise<CaseFile> {
    const { data } = await apiClient.delete<CaseFile>(
      `/cases/${caseId}/extensions/${extensionId}`,
    );
    return data;
  },

  /** Asks for a review at a date, after the window ends or the visits run out. */
  async scheduleFollowUp(caseId: string, dueAt: string, note: string): Promise<CaseFile> {
    const { data } = await apiClient.post<CaseFile>(`/cases/${caseId}/follow-up`, { dueAt, note });
    return data;
  },

  /**
   * Closes the case. The summary is required: a case that ends with no account
   * of how it ended is a record nobody can use later, including the clinician
   * who wrote it.
   *
   * Refused with `case_balance_outstanding` while accepted products are unpaid.
   * Closing is what makes a case immutable and no debt record lives outside a
   * case, so anything unsettled here would be unsettled forever.
   */
  async close(caseId: string, summary: string): Promise<CaseFile> {
    const { data } = await apiClient.post<CaseFile>(`/cases/${caseId}/close`, { summary });
    return data;
  },

  /**
   * The client picks which plan they are buying, without paying for it.
   *
   * Choosing and paying used to be one act — the treatment total only existed
   * once the client had paid in full through the `care-plan` rail — which left
   * a client whose therapist proposed a bare cadence with no treatment total,
   * nothing to take a deposit from, and no access to instalments at all.
   *
   * The therapist still owns the window; the plan only says what is bought.
   * Changeable until money is paid against treatment, then
   * `409 treatment_part_paid`, because a deposit was 70% of a particular price.
   */
  async choosePlan(caseId: string, planId: string): Promise<CaseBill> {
    const { data } = await apiClient.post<{ data: CaseBill }>(`/cases/${caseId}/plan/choose`, {
      planId,
    });
    return data.data;
  },

  /**
   * What the client owes for the case, treatment and products priced apart.
   *
   * Wrapped in `data` like every other read, so it is unwrapped once here
   * rather than at each screen.
   */
  async bill(caseId: string): Promise<CaseBill> {
    const { data } = await apiClient.get<{
      data: CaseBill;
      meta?: { productDisclaimer?: string | null };
    }>(`/cases/${caseId}/bill`);
    // Folded onto the bill so the screen has one object to render, not two.
    return { ...data.data, productDisclaimer: data.meta?.productDisclaimer ?? null };
  },

  /**
   * The products on this case and what the client said about each.
   *
   * Deliberately narrower than the case file: it carries the product, the
   * dosing note, the price and the line's state, and none of the diagnosis or
   * clinical notes — so a client screen can read it without being handed the
   * clinical record.
   */
  async recommendations(caseId: string): Promise<CaseRecommendations> {
    const { data } = await apiClient.get<{
      data: CaseFileRecommendation[];
      meta?: { productDisclaimer?: string | null };
    }>(`/cases/${caseId}/recommendations`);
    return { lines: data.data, productDisclaimer: data.meta?.productDisclaimer ?? null };
  },

  /**
   * The client accepts one recommended product, which is what turns it into
   * money owed. There is no decline: a line they do not want is left pending
   * and taken off by the therapist, because striking a prescribed item off the
   * record is a clinical decision.
   *
   * `acknowledged` is the client confirming they were shown the product
   * disclaimer. The server insists on it rather than trusting that the screen
   * rendered the text — the whole value of the statement is that it was made
   * before the money moved — and records it against the wording as it read at
   * the time. Sending the call without it is a 422.
   *
   * Returns the recomputed bill, so nothing needs a follow-up fetch.
   */
  async acceptRecommendation(caseId: string, lineId: string): Promise<CaseBill> {
    const { data } = await apiClient.post<{ data: CaseBill }>(
      `/cases/${caseId}/recommendations/${lineId}/accept`,
      { acknowledged: true },
    );
    return data.data;
  },

  /** Takes a line off the case. Refused once paid against, where removing it
   *  would be a refund rather than a delete — check `removable` first. */
  async removeRecommendation(caseId: string, lineId: string): Promise<CaseBill> {
    const { data } = await apiClient.delete<{ data: CaseBill }>(
      `/cases/${caseId}/recommendations/${lineId}`,
    );
    return data.data;
  },
};
