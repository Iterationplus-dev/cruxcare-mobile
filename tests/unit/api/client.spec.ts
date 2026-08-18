import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { apiClient, recoverJsonResponse, setUnauthorizedHandler } from '@/api/client';
import { server } from '@/mocks/server';
import { ApiError } from '@/types/api';

describe('apiClient error normalization', () => {
  it('wraps a 422 response as an ApiError with the server message', async () => {
    server.use(
      http.get(`${import.meta.env.VITE_API_BASE_URL}/test-422`, () =>
        HttpResponse.json({ message: 'Invalid input.', errors: { name: ['Required.'] } }, { status: 422 }),
      ),
    );
    await expect(apiClient.get('/test-422')).rejects.toMatchObject({
      status: 422,
      message: 'Invalid input.',
    });
  });

  it('calls the unauthorized handler on a 401', async () => {
    server.use(
      http.get(`${import.meta.env.VITE_API_BASE_URL}/test-401`, () =>
        HttpResponse.json({ message: 'Session expired.' }, { status: 401 }),
      ),
    );
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    await expect(apiClient.get('/test-401')).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledOnce();
    setUnauthorizedHandler(() => {}); // reset for other tests
  });

  it('recovers a JSON payload prefixed by a local PHP warning', () => {
    const data = '<br>Deprecated: local development warning</br>{"status":"ok"}';

    expect(recoverJsonResponse(data, 'application/json')).toEqual({ status: 'ok' });
  });

  it('unwraps a native bridge JSON string before recovering its trailing payload', () => {
    const data = JSON.stringify('<br>Deprecated: local development warning</br>{"status":"ok"}');

    expect(recoverJsonResponse(data, 'application/json')).toEqual({ status: 'ok' });
  });

  it('does not reinterpret a non-JSON response body', () => {
    const data = '<html>Gateway error</html>{"status":"ok"}';

    expect(recoverJsonResponse(data, 'text/html')).toBe(data);
  });
});
