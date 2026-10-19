import { apiClient } from './client';
import { getInstallationId } from '@/services/installationId';
import { ApiError } from '@/types/api';
import type { Address, ReferredBySource, TherapistPlanTier, User } from '@/types/user';

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  referredBySource: ReferredBySource;
  /** Where they are. Used to show clients therapists near them, and to place
   *  therapists in the directory. Omitted entirely when nothing was given. */
  address?: Address;
  /** From the device, and only when the person tapped to share it. Sent
   *  alongside the address rather than instead of it: coordinates cannot be
   *  turned into a city without a geocoder, and a city cannot be turned into
   *  coordinates. */
  latitude?: number;
  longitude?: number;
}

export type OtpChannel = 'sms' | 'whatsapp' | 'email';

export interface OtpRequestResult {
  sent: boolean;
  channel: OtpChannel;
  destination: string | null;
  expiresAt: string;
  resendAvailableAt: string;
}

export interface AuthSession {
  user: User;
  token: string;
}

/** Payment the provider still has to confirm — the plan is not active yet. */
export interface PendingPlanPayment {
  status: 'pending_payment';
  reference: string;
  plan: TherapistPlanTier;
  amount: number;
  currency: string;
  message: string;
}

export type TherapistActivationResult =
  | { status: 'active'; user: User }
  | { status: 'pending_payment'; payment: PendingPlanPayment };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUser(value: unknown): value is User {
  return isRecord(value) && typeof value.id === 'string' && Array.isArray(value.roles);
}

/**
 * A malformed 200 response must never create a half-authenticated session.
 * In particular, it prevents a server-side warning prepended to JSON from
 * being mistaken for a successful sign-in and then routed back to Welcome.
 */
function requireAuthSession(data: unknown): AuthSession {
  if (isRecord(data) && typeof data.token === 'string' && isUser(data.user)) {
    return data as unknown as AuthSession;
  }

  throw new ApiError(502, {
    message: 'The server returned an invalid sign-in response. Please try again.',
    code: 'invalid_auth_response',
  });
}

function requireUser(data: unknown): User {
  if (isUser(data)) return data;

  throw new ApiError(502, {
    message: 'The server returned an invalid account response. Please try again.',
    code: 'invalid_user_response',
  });
}

/**
 * Where a verification code was sent, with the destination masked.
 *
 * The code goes to the contact being *replaced*, not the new one. That is the
 * whole security value: someone who has taken a session cannot move the account
 * onto a channel they control, because only the person still holding the old
 * one sees the code.
 */
export interface ContactChangeChallenge {
  channel: string;
  destination: string | null;
}

/**
 * Sent on the calls that mint a token, and only those: the API records the
 * installation against the token at issue time so signing that device out later
 * can revoke its push registration too (backend note §11.2). Not a credential —
 * nothing authenticates on it — so it stays off every other request.
 *
 * A handset that cannot produce one still signs in; the session then behaves as
 * every session did before this existed.
 */
async function installationHeader(): Promise<Record<string, string>> {
  try {
    const id = await getInstallationId();
    return id ? { 'X-Installation-Id': id } : {};
  } catch (error) {
    console.error('Could not read this installation id.', error);
    return {};
  }
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<AuthSession> {
    const { data } = await apiClient.post<AuthSession>('/auth/register', payload, {
      headers: await installationHeader(),
    });
    return requireAuthSession(data);
  },

  async login(identifier: string, password: string): Promise<AuthSession> {
    const { data } = await apiClient.post<AuthSession>(
      '/auth/login',
      { identifier, password },
      { headers: await installationHeader() },
    );
    return requireAuthSession(data);
  },

  /**
   * `cruxId` is required by the API when `purpose` is `member-link` — it 422s
   * without it, though the handoff table has not caught up. Left out for the
   * other purposes, which have no Crux ID to send.
   */
  async requestOtp(
    channel: OtpChannel,
    purpose: 'signup' | 'recovery' | 'member-link',
    cruxId?: string,
  ): Promise<OtpRequestResult> {
    const { data } = await apiClient.post<OtpRequestResult>('/auth/otp/request', {
      channel,
      purpose,
      ...(cruxId ? { cruxId } : {}),
    });
    return data;
  },

  async changeSignupEmail(email: string): Promise<OtpRequestResult> {
    const { data } = await apiClient.post<OtpRequestResult>('/auth/signup/email', { email });
    return data;
  },
  /** Same `cruxId` rule as requestOtp: the API 422s without it for `member-link`. */
  async verifyOtp(code: string, purpose: 'signup' | 'recovery' | 'member-link', cruxId?: string) {
    const { data } = await apiClient.post<{ verified: boolean }>('/auth/otp/verify', {
      code,
      purpose,
      ...(cruxId ? { cruxId } : {}),
    });
    return data;
  },

  async enableBiometric() {
    await apiClient.post('/auth/biometric/enable');
  },

  /**
   * `allDevices` revokes every Sanctum token and push registration on the
   * account in one transaction (backend note 10.3). Absent or false, it ends
   * this session only — the shape every shipped build sent before it existed.
   */
  async logout(allDevices = false) {
    await apiClient.post('/auth/logout', allDevices ? { allDevices: true } : {});
  },

  async deleteAccount(password: string): Promise<{ deletionCompletesAt: string }> {
    const { data } = await apiClient.post<{ deletionCompletesAt: string }>('/me/delete', { password });
    return data;
  },

  /** Pre-auth recovery — identifier-based since there's no session token yet. */
  async requestPasswordReset(identifier: string, channel: 'sms' | 'whatsapp' | 'email') {
    await apiClient.post('/auth/password/forgot', { identifier, channel });
  },

  async resetPassword(identifier: string, code: string, newPassword: string, signOutOtherDevices: boolean) {
    await apiClient.post('/auth/password/reset', { identifier, code, newPassword, signOutOtherDevices });
  },

  async submitAssistedRecovery(payload: {
    identifier: string;
    contact: string;
    description: string;
  }): Promise<{ caseNumber: string }> {
    const { data } = await apiClient.post<{ caseNumber: string }>('/auth/recovery/assisted', payload);
    return data;
  },

  async me(): Promise<User> {
    const { data } = await apiClient.get<User>('/me');
    return requireUser(data);
  },

  /**
   * Turn two-step verification on or off. Changing it needs a live session,
   * which is the proof: whoever is asking already signed in on this device.
   */
  async setTwoFactor(enabled: boolean): Promise<User> {
    const { data } = await apiClient.post<User>('/auth/two-factor', { enabled });
    return data;
  },

  /** How payments run (PR6). Sent one key at a time; an omitted key is left
   *  alone rather than reset. */
  async updatePaymentPreferences(patch: {
    payFromWalletFirst?: boolean;
    saveMethods?: boolean;
  }): Promise<User> {
    const { data } = await apiClient.patch<User>('/me/payment-preferences', patch);
    return data;
  },

  /** Step one of changing an email. Sends a code to the *current* address. */
  async requestEmailChange(email: string): Promise<ContactChangeChallenge> {
    const { data } = await apiClient.post<ContactChangeChallenge>('/me/email/change', { email });
    return data;
  },

  /** Step two. Returns the whole user, so the caller writes it straight back
   *  into the session rather than refetching. */
  async confirmEmailChange(email: string, code: string): Promise<User> {
    const { data } = await apiClient.post<User>('/me/email/verify', { email, code });
    return data;
  },

  async requestPhoneChange(
    phone: string,
    channel: 'sms' | 'whatsapp' = 'sms',
  ): Promise<ContactChangeChallenge> {
    const { data } = await apiClient.post<ContactChangeChallenge>('/me/phone/change', {
      phone,
      channel,
    });
    return data;
  },

  async confirmPhoneChange(phone: string, code: string): Promise<User> {
    const { data } = await apiClient.post<User>('/me/phone/verify', { phone, code });
    return data;
  },

  async updateMe(
    patch: Partial<
      Pick<
        User,
        | 'firstName'
        | 'lastName'
        | 'gender'
        | 'about'
        | 'timezone'
        | 'nextOfKin'
        | 'privacy'
        | 'dateOfBirth'
        | 'language'
        | 'address'
        | 'avatarUrl'
        | 'payoutAccount'
      >
    >,
  ) {
    const { data } = await apiClient.patch<User>('/me', patch);
    return data;
  },

  async updateAvatar(photo: File): Promise<User> {
    const { data } = await apiClient.postForm<User>('/me/avatar', { photo });
    return requireUser(data);
  },

  async linkMembership(cruxId: string): Promise<User> {
    const { data } = await apiClient.post<User>('/me/membership/link', { cruxId });
    return data;
  },

  /**
   * A priced plan is paid for before it starts. Wallet payments settle
   * server-side and come back as an activated user; a gateway token cannot be
   * verified during the request, so the API answers `202` with a pending
   * result and the plan stays inactive until the provider confirms.
   */
  async activateTherapist(
    plan: TherapistPlanTier,
    paymentToken: string,
  ): Promise<TherapistActivationResult> {
    const response = await apiClient.post<User | PendingPlanPayment>('/me/therapist/activate', {
      plan,
      paymentToken,
    });

    if (response.status === 202) {
      return { status: 'pending_payment', payment: response.data as PendingPlanPayment };
    }

    return { status: 'active', user: requireUser(response.data) };
  },
};
