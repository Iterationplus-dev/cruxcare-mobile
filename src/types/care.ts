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

export type AppointmentStatus =
  | 'requested'
  | 'confirmed'
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
  clientName: string;
  therapistId: string;
  notes: CaseFileNote[];
  recommendations: CaseFileRecommendation[];
  sessionCount: number;
  lastSessionAt: string | null;
}

export interface ChatParticipant {
  id: string;
  name: string;
  avatarUrl: string | null;
  online: boolean;
}

export interface ChatAttachment {
  id: string;
  url: string;
  kind: 'image' | 'file';
  name: string;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  body: string;
  attachments: ChatAttachment[];
  sentAt: string;
  readAt: string | null;
}

export interface ChatThread {
  id: string;
  participants: ChatParticipant[];
  lastMessage: ChatMessage | null;
  unreadCount: number;
  scopeDisclaimer: string;
}
