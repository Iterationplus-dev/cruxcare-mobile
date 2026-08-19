import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { paymentsApi } from '@/api/payments.api';
import { useAuthStore } from '@/stores/auth';
import { demoCredentials } from '@/mocks/db';

vi.mock('@/services/secureStorage', () => ({
  secureStorage: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  SECURE_STORAGE_KEYS: { authToken: 'cc_auth_token', pushInstallationId: 'cc_push_id' },
}));

async function signIn() {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  await auth.login(demoCredentials.identifier, demoCredentials.password);
  return auth;
}

describe('paymentsApi', () => {
  beforeEach(async () => {
    await signIn();
  });

  it('has the server price the plan and mint the reference', async () => {
    const intent = await paymentsApi.createIntent({
      purpose: 'therapist-plan',
      subject: 'monthly',
    });

    expect(intent.reference).toMatch(/^CCPAY-/);
    expect(intent.amount).toBe(15);
    expect(intent.customerEmail).toBeTruthy();
  });

  it('rejects a stale quote rather than charging a different figure', async () => {
    await expect(
      paymentsApi.createIntent({
        purpose: 'therapist-plan',
        subject: 'monthly',
        expectedAmount: 9.99,
      }),
    ).rejects.toMatchObject({ status: 422, code: 'stale_quote' });
  });

  it('refuses to open an intent for something that costs nothing', async () => {
    await expect(
      paymentsApi.createIntent({ purpose: 'therapist-plan', subject: 'free-trial' }),
    ).rejects.toMatchObject({ status: 422, code: 'unpayable_subject' });
  });

  it('does not report settlement on the first confirmation', async () => {
    const intent = await paymentsApi.createIntent({
      purpose: 'therapist-plan',
      subject: 'yearly',
    });

    const first = await paymentsApi.confirm(intent.reference, 'MNFY|abc');

    expect(first.status).toBe('pending');
    expect(first.amountPaid).toBeNull();
    expect(first.settledAt).toBeNull();
  });

  it('reports settlement once the gateway has confirmed', async () => {
    const intent = await paymentsApi.createIntent({
      purpose: 'therapist-plan',
      subject: 'yearly',
    });
    await paymentsApi.confirm(intent.reference, 'MNFY|abc');

    const settled = await paymentsApi.get(intent.reference);

    expect(settled).toMatchObject({ status: 'settled', amountPaid: 200 });
  });

  it('does not expose another account’s payment', async () => {
    const intent = await paymentsApi.createIntent({
      purpose: 'therapist-plan',
      subject: 'monthly',
    });

    setActivePinia(createPinia());
    const other = useAuthStore();
    await other.register({
      firstName: 'Tola',
      lastName: 'Bello',
      email: `payer-${Date.now()}@example.com`,
      phone: '+2348012340000',
      password: 'Passw0rd!1',
      referredBySource: 'other',
    });

    await expect(paymentsApi.get(intent.reference)).rejects.toMatchObject({ status: 404 });
  });
});
