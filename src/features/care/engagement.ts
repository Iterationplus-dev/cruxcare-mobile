import { ApiError } from '@/types/api';
import type { CareEngagement, SupportContact, TherapistGender } from '@/types/care';

/**
 * CD2 · One therapist at a time.
 *
 * A client is tied to a therapist from the moment a request names one until
 * the case closes or is discontinued. An *unanswered* request ties them up as
 * well as an accepted one: asking elsewhere while somebody still owes you an
 * answer is how a client ends up with two therapists who do not know about
 * each other.
 *
 * Everything here reads the server's refusals rather than predicting them. The
 * app can gate a button on `mayChooseAnotherTherapist`, but the server is
 * still the one that decides, and these turn its answers into something a
 * screen can say.
 */

/** A refusal reader that only claims a match when the code says so. */
function metaOf(error: unknown, code: string): Record<string, unknown> | null {
  if (!(error instanceof ApiError) || error.code !== code) return null;
  return error.meta ?? {};
}

function str(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

export interface AssignedElsewhere {
  caseId: string | null;
  therapistId: string | null;
  therapistName: string | null;
}

/**
 * "You are already with someone else."
 *
 * Distinct from `duplicate_request`, which means "you already asked *this*
 * person". Both mean no, and a screen that says the same thing for each leaves
 * the client guessing which of the two they are in.
 */
export function assignedElsewhere(error: unknown): AssignedElsewhere | null {
  const meta = metaOf(error, 'therapist_already_assigned');
  if (!meta) return null;
  return {
    caseId: str(meta, 'caseId'),
    therapistId: str(meta, 'therapistId'),
    therapistName: str(meta, 'therapistName'),
  };
}

/**
 * "You cannot see this therapist while you are with someone else."
 *
 * A 403 rather than a 404, deliberately: the therapist plainly exists — the
 * client saw them yesterday and will again once they discontinue — so calling
 * them missing would be a lie the screen then has to explain badly. The
 * refusal names who the client is with, which is the only useful thing to say.
 */
export function blockedWhileEngaged(error: unknown): AssignedElsewhere | null {
  const meta = metaOf(error, 'therapist_not_available_while_engaged');
  if (!meta) return null;
  return {
    caseId: str(meta, 'caseId'),
    therapistId: str(meta, 'therapistId'),
    therapistName: str(meta, 'therapistName'),
  };
}

export interface StandingRequest {
  requestId: string | null;
  status: string | null;
}

/** "You already asked this person." Offer the standing request rather than
 *  only refusing — the client's next question is always "so where is it?". */
export function duplicateRequest(error: unknown): StandingRequest | null {
  const meta = metaOf(error, 'duplicate_request');
  if (!meta) return null;
  return { requestId: str(meta, 'requestId'), status: str(meta, 'status') };
}

/**
 * The dead end: discontinuing needs a human because there is something to
 * unpick — a diagnosis, a note, a plan, a product, a session or a payment.
 *
 * The contact has to be shown. The client cannot resolve this in the app, and
 * a bare refusal leaves them stuck with a therapist they have asked to leave.
 */
export function supportFromError(error: unknown): SupportContact | null {
  const meta = metaOf(error, 'discontinue_needs_support');
  if (!meta) return null;
  const support = (meta.support ?? {}) as Record<string, unknown>;
  const contact: SupportContact = {
    email: str(support, 'email'),
    phone: str(support, 'phone'),
    hours: str(support, 'hours'),
  };
  // An empty contact block is worse than none: it renders a "get in touch"
  // panel with nothing to get in touch with.
  return contact.email || contact.phone ? contact : null;
}

/**
 * What the ending button should say *before* it is tapped.
 *
 * `canDiscontinue` is the server telling us which of the two outcomes is
 * waiting, so the client is not offered "Discontinue" and then handed a
 * support phone number.
 */
export function discontinueAction(engagement: CareEngagement | null | undefined): {
  label: string;
  needsSupport: boolean;
} {
  const needsSupport = !!engagement && !engagement.canDiscontinue;
  return {
    label: needsSupport ? 'Contact support' : 'End this care',
    needsSupport,
  };
}

/** The gender filter chips. `prefer-not-to-say` is a therapist's own answer
 *  about themselves, so it is offered as a filter like any other. */
export const GENDER_FILTERS: { value: TherapistGender; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Not stated' },
];

/**
 * Whether the directory itself is empty, as opposed to a filter having matched
 * nobody.
 *
 * Gender filters server-side, so the list the screen holds is already the
 * filtered one and cannot tell the two apart by itself — the filter has to be
 * read alongside it. Conflating them cost the screen its own controls: the
 * "no therapists at all" branch replaced the search box and every chip, so a
 * gender nobody had recorded left the client on a tab root with the filter
 * still applied and nothing left to press to undo it.
 */
export function directoryIsEmpty(
  therapists: readonly unknown[] | undefined,
  genderFilter: TherapistGender | null,
): boolean {
  return !therapists?.length && !genderFilter;
}

/**
 * What an empty filtered directory should say.
 *
 * A therapist who has never recorded a gender matches *no* filter, so a
 * filtered list is always shorter than the unfiltered one and can be empty
 * while therapists plainly exist. Saying so is the difference between "there
 * is nobody" and "there is nobody who has told us".
 */
export function genderFilterEmptyMessage(filter: TherapistGender | null): string {
  if (!filter) return 'Try a different search or filter.';
  const label = GENDER_FILTERS.find((g) => g.value === filter)?.label.toLowerCase() ?? filter;
  return `No therapist has recorded ${label} as their gender. Therapists who have not answered do not appear under any gender filter, so clearing it will show more.`;
}
