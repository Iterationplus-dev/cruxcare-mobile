import { apiClient } from './client';
import type { CursorPage } from '@/types/api';

/** A signed-in device, projected from the token that actually grants it access
 *  rather than a separate store that could disagree with it. */
export interface ActiveDevice {
  id: string;
  name: string;
  lastSeenAt: string | null;
  platform?: string | null;
  /** The phone in your hand. */
  current: boolean;
}

/** One sign-in attempt. Failures are recorded too, and the attempted identifier
 *  is kept even when it resolves to nobody — often the interesting row. */
export interface LoginEvent {
  id: string;
  at: string;
  outcome: string;
  ip: string | null;
  device?: string | null;
  identifier?: string | null;
}

export const securityApi = {
  async devices(): Promise<ActiveDevice[]> {
    const { data } = await apiClient.get<CursorPage<ActiveDevice>>('/me/devices');
    return data.data;
  },

  /** Signs that device out. The token is revoked, so it is not a note in a
   *  list — the device genuinely loses access. */
  async forgetDevice(id: string): Promise<void> {
    await apiClient.delete(`/me/devices/${id}`);
  },

  async loginHistory(): Promise<LoginEvent[]> {
    const { data } = await apiClient.get<CursorPage<LoginEvent>>('/me/login-history');
    return data.data;
  },

  /** Current password required even inside a live session: a session left open
   *  on a borrowed phone should not be enough to take the account. */
  async changePassword(current: string, next: string): Promise<void> {
    await apiClient.post('/me/password', { current, next });
  },

  /** Asking twice returns the request already in flight rather than restarting
   *  the 48-hour promise. */
  async requestDataExport(): Promise<{ expectedBy: string | null }> {
    const { data } = await apiClient.post<{ expectedBy: string | null }>('/me/data-export');
    return data;
  },
};
