export interface TherapistSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
  specialties: string[];
  rating: number | null;
  nextAvailableSlot: string | null;
  fullyBooked: boolean;
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
