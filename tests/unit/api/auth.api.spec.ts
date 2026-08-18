import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { authApi } from '@/api/auth.api';
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
