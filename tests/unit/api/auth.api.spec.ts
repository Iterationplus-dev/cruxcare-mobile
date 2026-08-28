import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth.api';
import { setAuthTokenGetter } from '@/api/client';
import { server } from '@/mocks/server';

describe('authApi login identifier resolution', () => {
  it('accepts a username', async () => {
    const session = await authApi.login('amaka.obi', 'Passw0rd!1');

    expect(session.user.email).toBe('demo@cruxcare.app');
  });

  it('returns use_username for an email shared by multiple accounts', async () => {
    await expect(authApi.login('shared@cruxcare.app', 'Passw0rd!1')).rejects.toMatchObject({
      status: 401,
      code: 'use_username',
      message: 'Multiple accounts use this email address. Enter your username to log in.',
    });
  });

  it('rejects a malformed success response instead of creating a partial session', async () => {
    server.use(
      http.post(`${import.meta.env.VITE_API_BASE_URL}/auth/login`, () =>
        new HttpResponse('<br>Deprecated</br>{"user":{},"token":"token"}', {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(authApi.login('amaka.obi', 'Passw0rd!1')).rejects.toMatchObject({
      status: 502,
      code: 'invalid_auth_response',
    });
  });

  it('requests signup OTPs by email', async () => {
    let payload: unknown;
    server.use(
      http.post(`${import.meta.env.VITE_API_BASE_URL}/auth/otp/request`, async ({ request }) => {
        payload = await request.json();
        return HttpResponse.json({
          sent: true,
          channel: 'email',
          destination: 'si****@example.com',
          expiresAt: '2026-08-15T12:10:00.000Z',
          resendAvailableAt: '2026-08-15T12:01:00.000Z',
        });
      }),
    );

    const result = await authApi.requestOtp('email', 'signup');

    expect(payload).toEqual({ channel: 'email', purpose: 'signup' });
    expect(result).toMatchObject({
      channel: 'email',
      destination: 'si****@example.com',
      resendAvailableAt: '2026-08-15T12:01:00.000Z',
    });
  });

});

describe('authApi.updateMe gender', () => {
  afterEach(() => setAuthTokenGetter(() => null));

  async function signIn() {
    const session = await authApi.login('amaka.obi', 'Passw0rd!1');
    setAuthTokenGetter(() => session.token);
    return session;
  }

  it('returns the seeded gender before anything is changed', async () => {
    const session = await signIn();

    expect(session.user.gender).toBe('female');
  });

  it('saves a gender chosen from the dropdown', async () => {
    await signIn();

    const updated = await authApi.updateMe({ firstName: 'Amaka', lastName: 'Obi', gender: 'non-binary' });

    expect(updated.gender).toBe('non-binary');
  });

  it('clears the gender when null is sent', async () => {
    await signIn();

    const updated = await authApi.updateMe({ gender: null });

    expect(updated.gender).toBeNull();
  });

  it('rejects a value outside the published list instead of storing it', async () => {
    await signIn();

    await expect(
      authApi.updateMe({ gender: 'wizard' as never }),
    ).rejects.toMatchObject({ status: 422 });

    const after = await authApi.me();
    expect(after.gender).not.toBe('wizard');
  });
});
