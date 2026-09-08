import type { CursorPage } from '@/types/api';
export interface TherapistSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
  specialties: string[];
  rating: number | null;
  /** How many ratings the score is built on. Nothing collects them yet, so the
   *  server sends 0 — but a score without a count treats one review and two
   *  hundred as the same claim. */
  ratingCount?: number;
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

/**
 * What the server records on the case itself. Only these four are in use
 * (`new`, `active`, `rejected`, `closed`); the treatment stage a therapist
 * actually works through is derived from the case file, not from this — see
 * `caseStage`. Kept open-ended because the server capitalises inconsistently.
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export type CaseStatus = 'new' | 'active' | 'rejected' | 'closed' | (string & {});

/** How often the client is seen. The catalogue is server-owned; these are the
 *  four presets drawn in D2b, and `custom` is agreed with the therapist. */
// eslint-disable-next-line @typescript-eslint/ban-types
export type CarePlanCadence = 'weekly' | 'twice-weekly' | 'thrice-weekly' | 'custom' | (string & {});

/**
 * One row on the client's care plan screen (D2b).
 *
 * Every figure is the server's. `perVisitMinor` is sent rather than divided on
 * the device: a price the app computes and a price the app charges must never
 * be two different numbers, and rounding a division is exactly where they part.
 */
export interface CarePlanOption {
  id: string;
  cadence: CarePlanCadence;
  /** "2 visits a week" — the server's wording, not assembled from the cadence. */
  title: string;
  /** "3 months · 24 visits · $8.75 a visit" is built from these three. */
  durationLabel: string;
  visits: number;
  durationDays: number;
  amountMinor: number;
  perVisitMinor: number | null;
  currency: string;
  /** Drawn as the "Most chosen" pill. At most one option carries it. */
  recommended: boolean;
}

/**
 * What the client is paying for, once they have. `visitsRemaining` is the
 * balance the booking screen spends, and it is the server's count — the app
 * has no way to know about a visit booked on another device.
 */
export interface CareSubscription {
  id: string;
  planId: string;
  caseId: string;
  cadence: CarePlanCadence;
  status: CareSubscriptionStatus;
  visitsTotal: number;
  visitsUsed: number;
  visitsRemaining: number;
  startedAt: string | null;
  renewsAt: string | null;
  endsAt: string | null;
  /** Unused visits roll over for 30 days; this is when they stop being real. */
  rolloverEndsAt: string | null;
  amountMinor: number;
  currency: string;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export type CareSubscriptionStatus =
  | 'awaiting-payment'
  | 'active'
  | 'lapsed'
  | 'cancelled'
  | (string & {});

/**
 * The plan the therapist proposes and the client pays for. It is one object
 * because the three parts only mean anything together: a cadence with no
 * window is not a course of treatment, and a window with no cadence cannot be
 * scheduled.
 */
export interface TreatmentPlan {
  planId: string | null;
  cadence: CarePlanCadence | null;
  startDate: string | null;
  endDate: string | null;
  /** The therapist's own words on what the course is for. Shown to the client
   *  above the price, because a cadence alone is not a reason to pay. */
  summary: string | null;
  proposedAt: string | null;
  agreedAt: string | null;
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
  /**
   * Whether this therapist may read the client's health profile, carried on the
   * case file itself so opening one costs a single request rather than two.
   * Absent on servers older than backend note §15.5, which reads as "never asked".
   */
  healthProfileAccess?: CaseFileHealthAccess;
  /** The proposed course of treatment. Absent until the therapist writes one. */
  treatmentPlan?: TreatmentPlan;
  /** The client's paid plan, once there is one. Null while unpaid — which is
   *  a state the therapist must see, since it is what blocks starting. */
  subscription?: CareSubscription | null;
  /** When treatment actually began, as distinct from when it was planned to. */
  treatmentStartedAt?: string | null;
  closedAt?: string | null;
  closingSummary?: string | null;
  /** Set when the therapist asks for a review after the window ends. */
  followUpDueAt?: string | null;
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
  /** Why the therapist says they need it, in their own words, capped at 240 by
   *  the server. Shown to the client on the consent screen: a stated case is a
   *  different question to a bare demand. Null on rows raised before it existed. */
  reason: string | null;
  requestedAt: string;
  respondedAt: string | null;
}

/**
 * The same standing decision seen from the therapist's side, where one more
 * state exists: nobody has asked yet. The server sends `not-requested` rather
 * than omitting the object, because "never asked" and "asked and refused" are
 * different screens, and inferring one from the absence of the other reads
 * correctly for a year and then does not (backend note §15.5).
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export type CaseFileAccessStatus = 'not-requested' | HealthProfileAccessStatus;

export interface CaseFileHealthAccess {
  status: CaseFileAccessStatus;
  reason: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
}
