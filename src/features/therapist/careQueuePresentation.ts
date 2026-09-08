import type { CareRequestStatusLike } from '@/types/care';

/**
 * How an incoming request reads to the therapist deciding on it. Separate
 * from the client's vocabulary in `@/features/care/careRequestPresentation`:
 * the same `in-review` status means "we are looking into it" to a client and
 * "this is waiting on you" to the therapist holding it.
 */
export interface IncomingRequestPresentation {
  label: string;
  tone: 'default' | 'success' | 'warning' | 'danger';
  /** One line naming what, if anything, the therapist still has to do. */
  summary: string;
  /** True only while accept/decline is a valid move. */
  actionable: boolean;
}

const PRESENTATION: Record<string, IncomingRequestPresentation> = {
  submitted: {
    label: 'New',
    tone: 'warning',
    summary: 'This client asked for you and is waiting on your answer.',
    actionable: true,
  },
  'in-review': {
    label: 'Waiting on you',
    tone: 'warning',
    summary: 'This request is held for you. Accept it to take the case.',
    actionable: true,
  },
  accepted: {
    label: 'Accepted',
    tone: 'success',
    summary: 'You took this case. It is in your clients and case files.',
    actionable: false,
  },
  declined: {
    label: 'Declined',
    tone: 'default',
    summary: 'You passed on this case. CruxCare may re-match the client.',
    actionable: false,
  },
  cancelled: {
    label: 'Withdrawn',
    tone: 'default',
    summary: 'The client withdrew this request before it was answered.',
    actionable: false,
  },
  closed: {
    label: 'Closed',
    tone: 'default',
    summary: 'This request has been closed.',
    actionable: false,
  },
};

/**
 * An unknown status is shown, but **not** treated as actionable — the opposite
 * of the client rule, and deliberately so. On the client side an unrecognised
 * status leaves a Withdraw button, which at worst is refused. Here it would
 * offer to accept a case whose real state the app cannot name, so the safe
 * default is to render it and let the server-side queue move it on.
 */
export function presentIncomingRequest(status: CareRequestStatusLike): IncomingRequestPresentation {
  return (
    PRESENTATION[status] ?? {
      label: 'In progress',
      tone: 'default',
      summary: 'CruxCare is handling this request.',
      actionable: false,
    }
  );
}

/** Whether accept/decline should be offered at all. */
export function canRespondToRequest(status: CareRequestStatusLike): boolean {
  return presentIncomingRequest(status).actionable;
}
