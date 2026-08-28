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

/**
 * Self-described gender, shown as a dropdown on the profile. Labels live with
 * the values so the two cannot drift apart, and `Gender` is derived from the
 * list rather than repeated — adding an option is a one-line change.
 *
 * This is identity, not clinical sex-at-birth; anything the health profile
 * needs for care decisions is recorded there and asked for separately.
 */
export const genderOptions = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
] as const;

export type Gender = (typeof genderOptions)[number]['value'];

export type TherapistPlanTier = 'free-trial' | 'monthly' | 'yearly';

export interface TherapistProfile {
  /** Null on therapist accounts that never subscribed — the API returns
   *  `{ plan: null, status: 'inactive' }` for them. */
  plan: TherapistPlanTier | null;
  /** `inactive` covers therapist accounts that predate plan selection — the
   *  role exists but no plan was ever chosen, so nothing is subscribed yet. */
  status: 'active' | 'inactive' | 'expired' | 'pending-verification';
  clientLimit: number | null;
  caseFileLimit: number | null;
  clientCount: number;
  caseFileCount: number;
}

export interface PayoutAccount {
  accountHolder: string;
  institution: string;
  accountNumber: string;
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
  /** False only while a newly created account is still awaiting its signup OTP. */
  emailVerified?: boolean;
  phone: string;
  avatarUrl: string | null;
  roles: Role[];
  capabilities: Capability[];
  referredBySource: ReferredBySource | null;
  /** Optional: absent on accounts created before the field existed, and null
   *  once a member has been asked but declined to record one. */
  gender?: Gender | null;
  membership: Membership | null;
  therapistProfile: TherapistProfile | null;
  payoutAccount?: PayoutAccount | null;
  biometricEnabled: boolean;
  createdAt: string;
}

export function fullName(user: Pick<User, 'firstName' | 'lastName'>): string {
  return `${user.firstName} ${user.lastName}`.trim();
}
