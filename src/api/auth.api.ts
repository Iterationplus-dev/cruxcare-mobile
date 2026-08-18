import { apiClient } from './client';
import { ApiError } from '@/types/api';
import type { ReferredBySource, TherapistPlanTier, User } from '@/types/user';

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  referredBySource: ReferredBySource;
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

export const authApi = {
  async register(payload: RegisterPayload): Promise<AuthSession> {
    const { data } = await apiClient.post<AuthSession>('/auth/register', payload);
    return requireAuthSession(data);
  },

  async login(identifier: string, password: string): Promise<AuthSession> {
    const { data } = await apiClient.post<AuthSession>('/auth/login', { identifier, password });
    return requireAuthSession(data);
  },

  async requestOtp(channel: OtpChannel, purpose: 'signup' | 'recovery' | 'member-link'): Promise<OtpRequestResult> {
    const { data } = await apiClient.post<OtpRequestResult>('/auth/otp/request', { channel, purpose });
    return data;
  },

  async changeSignupEmail(email: string): Promise<OtpRequestResult> {
    const { data } = await apiClient.post<OtpRequestResult>('/auth/signup/email', { email });
    return data;
  },
  async verifyOtp(code: string, purpose: 'signup' | 'recovery' | 'member-link') {
    const { data } = await apiClient.post<{ verified: boolean }>('/auth/otp/verify', {
      code,
      purpose,
    });
    return data;
  },

  async enableBiometric() {
    await apiClient.post('/auth/biometric/enable');
  },

  async logout() {
    await apiClient.post('/auth/logout');
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

  async updateMe(patch: Partial<Pick<User, 'firstName' | 'lastName' | 'avatarUrl' | 'payoutAccount'>>) {
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

  async activateTherapist(plan: TherapistPlanTier): Promise<User> {
    const { data } = await apiClient.post<User>('/me/therapist/activate', { plan });
    return data;
  },
};
