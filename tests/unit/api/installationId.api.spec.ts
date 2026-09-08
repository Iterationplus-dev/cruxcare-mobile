import { createPinia, setActivePinia } from 'pinia';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/mocks/server';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/stores/auth';
import { demoCredentials } from '@/mocks/db';

const store = new Map<string, string>();
vi.mock('@/services/secureStorage', () => ({
  secureStorage: {
    get: (key: string) => Promise.resolve(store.get(key) ?? null),
    set: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
    remove: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
  },
  SECURE_STORAGE_KEYS: { authToken: 'cc_auth_token', pushInstallationId: 'cc_push_installation_id' },
}));

const base = import.meta.env.VITE_API_BASE_URL;

/** Captures the header the real handler would have seen, then passes through. */
function captureInstallationHeader(path: string, seen: { value: string | null }) {
  server.use(
    http.post(`${base}${path}`, ({ request }) => {
      seen.value = request.headers.get('X-Installation-Id');
      return HttpResponse.json({ message: 'stop here' }, { status: 422 });
    }),
  );
}

describe('X-Installation-Id', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('goes out on login, so the token can be tied to this handset', async () => {
    const seen = { value: null as string | null };
    captureInstallationHeader('/auth/login', seen);
    const auth = useAuthStore();

    await expect(auth.login(demoCredentials.identifier, demoCredentials.password)).rejects.toThrow();

    expect(seen.value).toBeTruthy();
    // A UUID kept in secure storage, not a hardware identifier.
    expect(seen.value).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('is the same id on a later call, so one handset stays one installation', async () => {
    const first = { value: null as string | null };
    captureInstallationHeader('/auth/login', first);
    const auth = useAuthStore();
    await auth.login(demoCredentials.identifier, demoCredentials.password).catch(() => undefined);

    const second = { value: null as string | null };
    captureInstallationHeader('/auth/login', second);
    await auth.login(demoCredentials.identifier, demoCredentials.password).catch(() => undefined);

    expect(second.value).toBe(first.value);
  });

  it('stays off requests that do not mint a token — it is a label, not a credential', async () => {
    const auth = useAuthStore();
    await auth.login(demoCredentials.identifier, demoCredentials.password);

    let seen: string | null = 'not-called';
    server.use(
      http.post(`${base}/auth/otp/request`, ({ request }) => {
        seen = request.headers.get('X-Installation-Id');
        return HttpResponse.json({ channel: 'sms', sentTo: '+2348000000000' });
      }),
    );
    await authApi.requestOtp('sms', 'signup');

    expect(seen).toBeNull();
  });
});
