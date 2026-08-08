import { apiClient } from './client';
import type { ReferredBySource, TherapistPlanTier, User } from '@/types/user';

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  referredBySource: ReferredBySource;
}

export interface AuthSession {
  user: User;
  token: string;
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<AuthSession> {
    const { data } = await apiClient.post<AuthSession>('/auth/register', payload);
    return data;
  },

  async login(identifier: string, password: string): Promise<AuthSession> {
    const { data } = await apiClient.post<AuthSession>('/auth/login', { identifier, password });
    return data;
  },

  async requestOtp(channel: 'sms' | 'whatsapp', purpose: 'signup' | 'recovery' | 'member-link') {
    await apiClient.post('/auth/otp/request', { channel, purpose });
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
    return data;
  },

  async updateMe(patch: Partial<Pick<User, 'firstName' | 'lastName' | 'avatarUrl'>>) {
    const { data } = await apiClient.patch<User>('/me', patch);
    return data;
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
