import { apiClient } from './client';
import type { CaseFile, TreatmentPlan } from '@/types/care';

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

  /** Asks for a review at a date, after the window ends or the visits run out. */
  async scheduleFollowUp(caseId: string, dueAt: string, note: string): Promise<CaseFile> {
    const { data } = await apiClient.post<CaseFile>(`/cases/${caseId}/follow-up`, { dueAt, note });
    return data;
  },

  /**
   * Closes the case. The summary is required: a case that ends with no account
   * of how it ended is a record nobody can use later, including the clinician
   * who wrote it.
   */
  async close(caseId: string, summary: string): Promise<CaseFile> {
    const { data } = await apiClient.post<CaseFile>(`/cases/${caseId}/close`, { summary });
    return data;
  },
};
