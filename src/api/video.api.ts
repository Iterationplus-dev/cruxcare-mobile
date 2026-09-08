import { apiClient } from './client';
import type { RecordingConsent, VideoSessionToken } from '@/types/video';

export const videoApi = {
  /**
   * Asked for when the user taps Join, never pre-fetched on a list: the token
   * expires in 15 minutes and pre-fetching mints tokens for calls nobody joins.
   * Asking again returns the same room with a fresh token.
   */
  async token(appointmentId: string): Promise<VideoSessionToken> {
    const { data } = await apiClient.post<VideoSessionToken>(
      `/appointments/${appointmentId}/video/token`,
    );
    return data;
  },

  /**
   * Ejects everyone. This is the therapist's control only — a participant
   * leaving is the provider's own `leave()` and needs no call at all.
   */
  async end(appointmentId: string): Promise<void> {
    await apiClient.post(`/appointments/${appointmentId}/video/end`);
  },

  async consent(appointmentId: string): Promise<RecordingConsent> {
    const { data } = await apiClient.get<RecordingConsent>(
      `/appointments/${appointmentId}/video/consent`,
    );
    return data;
  },

  /**
   * Withdrawing stops a recording in progress before this resolves — the harm
   * is happening while the user waits, so it is not queued behind anything.
   * What was already captured is not deleted.
   */
  async setConsent(appointmentId: string, granted: boolean): Promise<RecordingConsent> {
    const { data } = await apiClient.put<RecordingConsent>(
      `/appointments/${appointmentId}/video/consent`,
      { granted },
    );
    return data;
  },
};
