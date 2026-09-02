import type { CursorPage } from '@/types/api';
export interface TherapistSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
  specialties: string[];
  rating: number | null;
  location?: string | null;
  bio?: string | null;
  experienceYears?: number | null;
  languages?: string[];
  nextAvailableSlot: string | null;
  fullyBooked: boolean;
  /**
   * Whether they have said which days they work.
   *
   * Three different things produce no `nextAvailableSlot`: at capacity, marked
   * unavailable, or simply never set hours. This separates the last from the
   * other two, because calling someone with a completely empty diary "fully
   * booked" is a false statement about them.
   *
   * Optional so an older server that does not send it reads as unknown rather
   * than as false, which would label every therapist as having no hours.
   */
  schedulePublished?: boolean;
}

/** Sunday is 0, matching both the server's storage and `Date.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** One working day on a therapist's rota. `"09:00"`, not `"09:00:00"`. */
export interface WorkingDay {
  weekday: Weekday;
  opensAt: string;
  closesAt: string;
}

/**
 * A therapist's rota, in the therapist's own clock.
 *
 * The times are already converted; storage is UTC. `meta.timezone` names the
 * clock so no screen has to guess whose hours it is showing — before it did, a
 * therapist in Lagos setting "09:00" was setting 10:00 their own time with
 * nothing saying so.
 *
 * It travels in `meta` rather than beside the rows because whose clock these
 * hours are in is a fact about the set, not a column on a row.
 */
export type TherapistRota = CursorPage<WorkingDay> & {
  meta: {
    /** An IANA name, or null when the therapist has never been asked — in
     *  which case the hours read as UTC, which is what every rota written
     *  before the column existed already is. */
    timezone?: string | null;
  };
};

/**
 * What a client's booking calendar can offer on one date.
 *
 * Every time here comes from the therapist's own rota minus what is already
 * booked. An empty `slots` means closed, and a range that comes back empty
 * altogether means nothing in it is bookable at all.
 */
export interface TherapistAvailabilityDay {
  date: string;
  slots: string[];
}

/**
 * Where a client's request for a therapist has got to. Assignment is a staff
 * workflow, so the client sees progress rather than an instant answer.
 *
 * `submitted` — received, not yet looked at.
 * `in-review`  — CruxCare is matching, or the named therapist is deciding.
 * `accepted`   — a therapist took the case; the client now has care.
 * `declined`   — the named therapist could not take it; staff may re-match.
 * `cancelled`  — withdrawn by the client.
 * `closed`     — resolved and no longer progressing.
 */
export type CareRequestStatus =
  | 'submitted'
  | 'in-review'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'closed';

/** Statuses stay open-ended for the same reason ledger types are: an unknown
 * server value renders with the neutral treatment instead of breaking the
 * screen. See `TransactionTypeLike` in `@/types/wallet`. */
// `string & {}` is the standard way to widen a union to any string while
// keeping the known values in autocomplete; `string` alone would swallow them.
// eslint-disable-next-line @typescript-eslint/ban-types
export type CareRequestStatusLike = CareRequestStatus | (string & {});

/**
 * One step the request has actually passed through. Server-authored — the app
 * never invents a step or predicts the next one, so a stalled request looks
 * stalled instead of appearing to progress on its own.
 */
export interface CareRequestEvent {
  id: string;
  status: CareRequestStatusLike;
  /** Short line for the client, e.g. "Chidi Nwosu accepted your request". */
  label: string;
  /** Optional detail; safe to show verbatim. */
  note?: string | null;
  at: string;
}

export interface CareRequest {
  id: string;
  /** Quoted to support, so it is shown on the request itself. */
  reference: string;
  status: CareRequestStatusLike;
  /** What the client asked for. */
  reason: string;
  /** Null on an open request left for staff to match. */
  therapistId: string | null;
  therapistName: string | null;
  therapistAvatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  /** Oldest first. Empty until the server records a first step. */
  events: CareRequestEvent[];
}

/**
 * The same request seen from the therapist's side of the case. It carries the
 * client instead of the therapist, because that is the identity the therapist
 * is deciding about — a therapist reading their queue already knows who they
 * are. `events` is the same server-authored trail the client sees, so both
 * sides read one history rather than two accounts of it.
 */
export interface TherapistCareRequest {
  id: string;
  /** Same reference the client quotes to support. */
  reference: string;
  status: CareRequestStatusLike;
  /** What the client asked for, shown before any decision is taken. */
  reason: string;
  clientId: string;
  clientName: string;
  clientAvatarUrl: string | null;
  /**
   * The case file opened when this request was accepted, or null while there
   * is nothing to open. A care request and a case file are different records,
   * so the id has to be carried rather than assumed from the client's.
   */
  caseFileId: string | null;
  createdAt: string;
  updatedAt: string;
  events: CareRequestEvent[];
}

/**
 * `active` is a session in progress — the therapist has started it.
 *
 * The column behind it is `in_session`; `active` is the wire word, because the
 * legacy web app already writes `active` to mean confirmed. Nothing here needs
 * to know that, but it is why the two names differ.
 */
export type AppointmentStatus =
  | 'requested'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'no-show';

export type AppointmentType = 'in-person' | 'video' | 'chat';

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  therapistId: string;
  therapistName: string;
  slot: string;
  type: AppointmentType;
  status: AppointmentStatus;
  reason: string | null;
  cancellationCutoff: string | null;
}

export interface HealthProfileSection {
  key: string;
  label: string;
  value: string | null;
}

export interface HealthProfile {
  clientId: string;
  sections: HealthProfileSection[];
  consentVersion: string | null;
  consentedAt: string | null;
  lastUpdatedAt: string | null;
}

export interface CaseFileNote {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
  draft: boolean;
}

export interface CaseFileRecommendation {
  id: string;
  productId: string;
  productName: string;
  note: string | null;
  orderId: string | null;
}

export interface CaseFile {
  id: string;
  clientId: string;
  therapistId: string;
  notes: CaseFileNote[];
  recommendations: CaseFileRecommendation[];
  /**
   * A file opened by accepting a care request carries nothing yet — the
   * therapist has diagnosed nothing and set no treatment window. Everything
   * below is therefore absent or null on a fresh file and must render as
   * "not recorded", never as a blank line.
   */
  clientName?: string;
  status?: string | null;
  diagnosis?: string | null;
  treatmentStartDate?: string | null;
  treatmentEndDate?: string | null;
  sessionCount?: number | null;
  lastSessionAt?: string | null;
  /** Soonest appointment still ahead that is not cancelled or missed. */
  nextSessionAt?: string | null;
  noShowCount?: number | null;
  /** When the oldest draft note was started, or null when none waits. */
  unwrittenNoteFrom?: string | null;
  lastMessageAt?: string | null;
  /**
   * Which of the Clients tabs this client belongs in, decided server-side.
   * The client no longer derives it: a classification the counts are built
   * from has to come from the same place the counts do.
   */
  relationshipState?: ClientRelationshipState;
}

/** Matches the server's vocabulary exactly. */
// eslint-disable-next-line @typescript-eslint/ban-types
export type ClientRelationshipState = 'active' | 'needs-follow-up' | 'past' | (string & {});

/** How many clients sit in each state, across everything the caller can see —
 *  not just the loaded page, and unaffected by the current filter. */
export interface ClientStateCounts {
  active: number;
  needsFollowUp: number;
  past: number;
}

export interface ChatParticipant {
  id: string;
  name: string;
  avatarUrl: string | null;
  online: boolean;
}

/** The server sends only a url today; the rest is optional so a richer
 *  attachment does not need a type change to start rendering. */
export interface ChatAttachment {
  url: string;
  id?: string;
  kind?: 'image' | 'file';
  name?: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  attachments: ChatAttachment[];
  /** When it was sent. Named for the wire: reading `sentAt` here is what put
   *  "Invalid Date" under every message on both sides of the conversation. */
  createdAt: string;
  /** Whether the other side has read it. The server sends a flag, not a time,
   *  so a read receipt can say that it was read but not when. */
  read: boolean;
}

/**
 * A conversation as the list returns it, shaped to what the server sends: the
 * other person is flattened onto the thread rather than given as a participant
 * array, because a thread is always between the caller and one other person.
 *
 * `lastMessage` is the preview text, not a message record — the list never
 * needs the rest of it, and fetching the thread gives the full history.
 */
export interface ChatThread {
  id: string;
  participantId: string;
  participantName: string;
  participantAvatarUrl: string | null;
  /** Preview text for the row, or null on a thread nobody has written in. */
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  muted: boolean;
  /**
   * `open` while the conversation accepts messages. Chats stay open for a
   * period after the last session and then become read-only, so the composer
   * follows this rather than assuming a thread can always be written to.
   */
  status: ChatThreadStatus;
  /** When an open thread will close, or null when nothing is scheduled. */
  closesAt: string | null;
  /** Why a closed thread closed — rendered verbatim, e.g. "sessions ended 12 Jul". */
  closedReason: string | null;
}

/** Open-ended for the same reason the care statuses are: an unknown value
 *  renders as read-only rather than breaking the screen. */
// eslint-disable-next-line @typescript-eslint/ban-types
export type ChatThreadStatus = 'open' | 'read-only' | (string & {});

/**
 * One therapist's standing permission to read the signed-in client's health
 * profile.
 *
 * Acceptance of a care request permits the *question*; it does not answer it.
 * `pending` is a therapist waiting on the client, `granted` is live access, and
 * `revoked` covers both a refusal and a permission taken back — to the client
 * those are one action, so the server records them as one status.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export type HealthProfileAccessStatus = 'pending' | 'granted' | 'revoked' | (string & {});

export interface HealthProfileAccess {
  id: string;
  therapistId: string;
  therapistName: string | null;
  clientId: string;
  status: HealthProfileAccessStatus;
  requestedAt: string;
  respondedAt: string | null;
}
