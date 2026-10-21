import { ApiError } from '@/types/api';
import type { CaseFileHealthAccess } from '@/types/care';

export type HealthAccessKind =
  | 'not-requested'
  | 'pending'
  | 'granted'
  | 'revoked'
  | 'lapsed'
  | 'unavailable';

export interface HealthAccessView {
  kind: HealthAccessKind;
  title: string;
  message: string;
  /** Whether to offer the "Ask to read" control. Never true while an answer is
   *  outstanding: there is nothing for a second ask to achieve. */
  canRequest: boolean;
  /** Whether the profile sections should be fetched and rendered. */
  showsProfile: boolean;
}

/**
 * What the therapist's health profile panel shows, from the access state the
 * case file carries and — where a granted read was attempted — whatever that
 * read answered.
 *
 * Two sources rather than one because they can disagree honestly: the case file
 * says `granted`, and by the time the profile is fetched the client has
 * withdrawn, or the therapist's plan has lapsed. The read is the later fact, so
 * it wins.
 */
export function healthProfileAccessView(
  access: CaseFileHealthAccess | undefined,
  readError?: unknown,
): HealthAccessView {
  const status = access?.status ?? 'not-requested';

  if (status === 'granted') {
    const refusal = readRefusal(readError);
    if (refusal) return refusal;
    return {
      kind: 'granted',
      title: 'Health profile',
      message: 'Shared by the client. They can withdraw this at any time.',
      canRequest: false,
      showsProfile: true,
    };
  }

  if (status === 'pending') {
    return {
      kind: 'pending',
      title: 'Waiting for an answer',
      message: 'The client has been asked and has not answered yet.',
      // No retry control: a second ask does not make the first one arrive.
      canRequest: false,
      showsProfile: false,
    };
  }

  if (status === 'revoked') {
    return {
      kind: 'revoked',
      title: 'Not shared',
      // Refused and withdrawn are one status, so the copy has to be true of
      // both — "declined again" would be a guess about which one happened.
      message: 'The client has not shared their health profile with you.',
      // Asking again is allowed for as long as they keep you on the case.
      canRequest: true,
      showsProfile: false,
    };
  }

  return {
    kind: 'not-requested',
    title: 'Health profile',
    message: 'You have not asked to read this client’s health profile.',
    canRequest: true,
    showsProfile: false,
  };
}

/**
 * A granted read that came back refused anyway. Returns null when the error is
 * not one of those, so an ordinary network failure is not reported as a
 * consent decision.
 */
function readRefusal(error: unknown): HealthAccessView | null {
  if (error === undefined || error === null) return null;

  if (error instanceof ApiError) {
    switch (error.code) {
      case 'plan_lapsed':
        return {
          kind: 'lapsed',
          title: 'Your plan has expired',
          // Never "this client has revoked access": the client did nothing,
          // and saying they did would be both untrue and alarming (§13.3).
          message: 'Renew to continue reading your clients’ health profiles.',
          canRequest: false,
          showsProfile: false,
        };
      case 'access_revoked':
        return {
          kind: 'revoked',
          title: 'Not shared',
          message: 'The client has withdrawn access to their health profile.',
          canRequest: true,
          showsProfile: false,
        };
      case 'access_pending':
        return {
          kind: 'pending',
          title: 'Waiting for an answer',
          message: 'The client has been asked and has not answered yet.',
          canRequest: false,
          showsProfile: false,
        };
      case 'access_not_requested':
        return {
          kind: 'not-requested',
          title: 'Health profile',
          message: 'You have not asked to read this client’s health profile.',
          canRequest: true,
          showsProfile: false,
        };
      default:
        break;
    }
  }

  return {
    kind: 'unavailable',
    title: 'Could not load the health profile',
    message:
      error instanceof ApiError
        ? error.message
        : 'Check your connection and try again.',
    canRequest: false,
    showsProfile: false,
  };
}

/**
 * Why an ask was refused. The two 409s are not failures the therapist caused —
 * they mean this screen was looking at a stale answer — so they read as a
 * prompt to refresh rather than as an error.
 */
export function healthAccessRequestRefusal(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return 'We could not send your request. Please try again.';
  }

  switch (error.code) {
    case 'access_already_requested':
      return 'You have already asked. The client has not answered yet.';
    case 'access_already_granted':
      return 'The client has already shared their health profile with you.';
    case 'client_not_found':
      return 'This client is not on your list, so you cannot ask to read their profile.';
    default:
      return error.message;
  }
}
