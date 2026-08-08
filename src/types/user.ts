/** PRD §2 roles. A single account can hold more than one. */
export type Role = 'client' | 'member' | 'therapist' | 'admin';

/** Fine-grained server-issued abilities (Sanctum token abilities). The UI
 * hides based on these; the server is always the enforcer (README §guardrails). */
export type Capability =
  | 'orders.place'
  | 'appointments.book'
  | 'health-profile.write'
  | 'case-files.manage'
  | 'wallet.read'
  | 'wallet.write'
  | 'admin.approve';

export type ReferredBySource =
  | 'facebook'
  | 'whatsapp'
  | 'member'
  | 'therapist'
  | 'admin'
  | 'google-ads'
  | 'friends-family'
  | 'other';

export type TherapistPlanTier = 'free-trial' | 'monthly' | 'yearly';

export interface TherapistProfile {
  plan: TherapistPlanTier;
  status: 'active' | 'expired' | 'pending-verification';
  clientLimit: number | null;
  caseFileLimit: number | null;
  clientCount: number;
  caseFileCount: number;
}

export interface Membership {
  cruxId: string;
  /** e.g. "CCI8804XO" — three letters, four digits, two letters. */
  tier: string | null;
  joinedAt: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  roles: Role[];
  capabilities: Capability[];
  referredBySource: ReferredBySource | null;
  membership: Membership | null;
  therapistProfile: TherapistProfile | null;
  biometricEnabled: boolean;
  createdAt: string;
}

export function fullName(user: Pick<User, 'firstName' | 'lastName'>): string {
  return `${user.firstName} ${user.lastName}`.trim();
}
