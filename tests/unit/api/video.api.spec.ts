import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { videoApi } from '@/api/video.api';
import { appointmentsApi } from '@/api/appointments.api';
import { useAuthStore } from '@/stores/auth';
import { demoCredentials } from '@/mocks/db';
import { ApiError } from '@/types/api';

vi.mock('@/services/secureStorage', () => ({
  secureStorage: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  SECURE_STORAGE_KEYS: { authToken: 'cc_auth_token', pushInstallationId: 'cc_push_id' },
}));

/** A video appointment inside the join window, which is what the API gates on. */
async function joinableVideoAppointment() {
  const appointment = await appointmentsApi.create({
    therapistId: 'therapist-1',
    slot: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    type: 'video',
  });
  return appointment.id;
}

describe('video sessions', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    const auth = useAuthStore();
    await auth.login(demoCredentials.identifier, demoCredentials.password);
  });

  it('hands back a room the client never had to name', async () => {
    const session = await videoApi.token(await joinableVideoAppointment());

    expect(session.url).toContain(session.roomId);
    expect(session.token).toBeTruthy();
    expect(session.role).toBe('guest');
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('returns the same room on a refresh, so a reconnect is not a second call', async () => {
    const id = await joinableVideoAppointment();

    const first = await videoApi.token(id);
    const second = await videoApi.token(id);

    expect(second.roomId).toBe(first.roomId);
  });

  it('refuses a session outside its window with the times to render', async () => {
    const appointment = await appointmentsApi.create({
      therapistId: 'therapist-1',
      slot: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      type: 'video',
    });

    await expect(videoApi.token(appointment.id)).rejects.toMatchObject({
      code: 'outside_session_window',
    });
    const error = await videoApi.token(appointment.id).catch((e: unknown) => e as ApiError);
    expect((error as ApiError).meta?.opensAt).toBeTruthy();
  });

  it('refuses an appointment that is not a video visit', async () => {
    const appointment = await appointmentsApi.create({
      therapistId: 'therapist-1',
      slot: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      type: 'in-person',
    });

    await expect(videoApi.token(appointment.id)).rejects.toMatchObject({
      code: 'session_not_video',
    });
  });

  it('never says whether someone else’s session exists', async () => {
    await expect(videoApi.token('appointment-that-is-not-yours')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('records nothing until both sides have actively agreed', async () => {
    const id = await joinableVideoAppointment();

    // Silence is not agreement.
    expect(await videoApi.consent(id)).toEqual({ mine: false, theirs: false, canRecord: false });

    const afterMine = await videoApi.setConsent(id, true);
    expect(afterMine).toMatchObject({ mine: true, theirs: false, canRecord: false });
  });

  it('withdrawing consent closes the door again', async () => {
    const id = await joinableVideoAppointment();
    await videoApi.setConsent(id, true);

    const withdrawn = await videoApi.setConsent(id, false);

    expect(withdrawn.mine).toBe(false);
    expect(withdrawn.canRecord).toBe(false);
  });

  it('refuses to let a client end the session for everyone', async () => {
    const id = await joinableVideoAppointment();

    await expect(videoApi.end(id)).rejects.toMatchObject({ code: 'not_session_host' });
  });
});
