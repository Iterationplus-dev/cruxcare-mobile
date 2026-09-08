import type { CaseFile } from '@/types/care';

export type CaseStage =
  | 'assessment'
  | 'planning'
  | 'awaiting-payment'
  | 'ready-to-start'
  | 'in-treatment'
  | 'follow-up'
  | 'closed';

export interface CaseStageView {
  stage: CaseStage;
  /** What this case is waiting on, said as a state rather than an instruction. */
  label: string;
  /** Who the case is currently waiting on. Drives the tone, and stops the app
   *  nagging a therapist about something only the client can do. */
  waitingOn: 'therapist' | 'client' | 'nobody';
  detail: string;
}

const SETTLED = ['closed', 'rejected', 'cancelled'];

/**
 * Where a case has got to.
 *
 * Derived from what is recorded rather than read from a status column, because
 * the server keeps only four statuses (`new`, `active`, `rejected`, `closed`)
 * and the course of treatment has more steps than that. Deriving it also means
 * the app cannot show a stage the underlying data does not support — a case
 * cannot claim to be in treatment with no plan and nothing paid.
 *
 * The order of the checks is the order of the flow, and each one is the
 * question "what is missing?" asked once.
 */
export function caseStage(caseFile: CaseFile | undefined): CaseStageView {
  if (!caseFile) {
    return {
      stage: 'assessment',
      label: 'Not started',
      waitingOn: 'therapist',
      detail: 'This case has not been opened yet.',
    };
  }

  const status = (caseFile.status ?? '').toLowerCase();
  if (status && SETTLED.includes(status)) {
    return {
      stage: 'closed',
      label: 'Closed',
      waitingOn: 'nobody',
      detail: caseFile.closingSummary?.trim()
        ? caseFile.closingSummary
        : 'This case is closed. The record stays readable.',
    };
  }

  if (!caseFile.diagnosis?.trim()) {
    return {
      stage: 'assessment',
      label: 'Assessment',
      waitingOn: 'therapist',
      detail: 'Record a diagnosis to begin a course of treatment.',
    };
  }

  const plan = caseFile.treatmentPlan;
  if (!plan?.cadence || !plan.startDate) {
    return {
      stage: 'planning',
      label: 'Planning',
      waitingOn: 'therapist',
      detail: 'Set a cadence and a treatment window for this client to agree to.',
    };
  }

  const subscription = caseFile.subscription;
  if (!subscription || subscription.status === 'awaiting-payment') {
    return {
      stage: 'awaiting-payment',
      label: 'Waiting for payment',
      // Nothing here is the therapist's to do, so the screen offers them
      // nothing to press. Naming who it waits on is what prevents that.
      waitingOn: 'client',
      detail: 'The client has the plan and has not paid for it yet.',
    };
  }

  if (subscription.status === 'lapsed' || subscription.status === 'cancelled') {
    return {
      stage: 'awaiting-payment',
      label: subscription.status === 'lapsed' ? 'Plan expired' : 'Plan cancelled',
      waitingOn: 'client',
      detail:
        subscription.status === 'lapsed'
          ? 'Their plan has run out. Sessions resume when they renew.'
          : 'They cancelled this plan. Sessions resume if they take a new one.',
    };
  }

  if (!caseFile.treatmentStartedAt) {
    return {
      stage: 'ready-to-start',
      label: 'Ready to start',
      waitingOn: 'therapist',
      detail: 'The plan is paid for. Start treatment to begin scheduling sessions.',
    };
  }

  if (isPast(plan.endDate) || subscription.visitsRemaining <= 0) {
    return {
      stage: 'follow-up',
      label: 'Follow-up',
      waitingOn: 'therapist',
      // Two different ways to arrive here, and they are not the same
      // conversation, so the sentence says which one happened.
      detail: isPast(plan.endDate)
        ? 'The treatment window has ended. Review the outcome, extend, or close the case.'
        : 'Every visit on this plan has been used. Review the outcome, extend, or close the case.',
    };
  }

  return {
    stage: 'in-treatment',
    label: 'In treatment',
    waitingOn: 'nobody',
    detail: `${subscription.visitsRemaining} of ${subscription.visitsTotal} visits left.`,
  };
}

function isPast(date: string | null | undefined): boolean {
  if (!date) return false;
  const at = new Date(date);
  if (Number.isNaN(at.getTime())) return false;
  // Compared by day, not by instant: a window ending today has not ended.
  const endOfDay = new Date(at);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay.getTime() < Date.now();
}

/** Whether the therapist may edit the plan. A paid plan is an agreement, so it
 *  is changed by proposing a new one, never edited underneath the client. */
export function canEditTreatmentPlan(caseFile: CaseFile | undefined): boolean {
  const { stage } = caseStage(caseFile);
  return stage === 'planning' || stage === 'assessment' || stage === 'follow-up';
}

/** Whether sessions can be booked against this case right now. */
export function canScheduleSessions(caseFile: CaseFile | undefined): boolean {
  const { stage } = caseStage(caseFile);
  return stage === 'in-treatment';
}
