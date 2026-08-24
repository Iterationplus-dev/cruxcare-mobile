import type { CareRequestStatusLike } from '@/types/care';

/**
 * How a request status reads to the client. Kept out of the screen so the
 * vocabulary is testable and so an unfamiliar server value has one defined
 * fallback rather than one per template branch.
 */
export interface CareRequestPresentation {
  label: string;
  tone: 'default' | 'success' | 'warning' | 'danger';
  /** One line telling the client what is happening and what to expect next. */
  summary: string;
  /** False once the request has stopped moving. */
  open: boolean;
}

const PRESENTATION: Record<string, CareRequestPresentation> = {
  submitted: {
    label: 'Sent',
    tone: 'default',
    summary: 'CruxCare has your request and will start matching shortly.',
    open: true,
  },
  'in-review': {
    label: 'In review',
    tone: 'warning',
    summary: 'Your request is being reviewed. We will let you know as soon as it moves.',
    open: true,
  },
  accepted: {
    label: 'Accepted',
    tone: 'success',
    summary: 'A therapist has taken your case. You can message and book from Care.',
    open: false,
  },
  declined: {
    label: 'Declined',
    tone: 'danger',
    summary: 'That therapist could not take the case. You can request someone else.',
    open: false,
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'default',
    summary: 'You withdrew this request.',
    open: false,
  },
  closed: {
    label: 'Closed',
    tone: 'default',
    summary: 'This request has been closed.',
    open: false,
  },
};

/**
 * An unknown status is treated as still open: the request exists on the
 * server, so claiming it has finished would be a stronger statement than the
 * app can support.
 */
export function presentCareRequest(status: CareRequestStatusLike): CareRequestPresentation {
  return (
    PRESENTATION[status] ?? {
      label: 'In progress',
      tone: 'default',
      summary: 'CruxCare is working on this request.',
      open: true,
    }
  );
}

/** Only an unfinished request can be withdrawn. */
export function canCancelCareRequest(status: CareRequestStatusLike): boolean {
  return presentCareRequest(status).open;
}
