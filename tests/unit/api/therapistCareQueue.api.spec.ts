import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { careQueueApi } from '@/api/care-queue.api';
import { therapistsApi } from '@/api/therapists.api';
import { useAuthStore } from '@/stores/auth';
import { careRequests, demoCredentials, users } from '@/mocks/db';
import { uiTestCredentials } from '@/mocks/testAccount';

vi.mock('@/services/secureStorage', () => ({
  secureStorage: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  SECURE_STORAGE_KEYS: { authToken: 'cc_auth_token', pushInstallationId: 'cc_push_id' },
}));

/** Each sign-in gets a fresh Pinia: the api client reads the token from
 * whichever store is active, so the two roles must not share one. */
async function signIn(credentials: { identifier: string; password: string }) {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  await auth.login(credentials.identifier, credentials.password);
  return auth;
}

const asClient = () => signIn(uiTestCredentials);
/** The demo account practises as `therapist-1` and holds an active plan. */
const asTherapist = () => signIn(demoCredentials);

describe('therapist care request queue', () => {
  beforeEach(() => {
    careRequests.clear();
  });

  it('delivers a request naming a therapist to that therapist', async () => {
    await asClient();
    const sent = await therapistsApi.requestAssignment('I would like to work with you.', 'therapist-1');

    await asTherapist();
    const queue = await careQueueApi.list();

    // The whole point of the flow: the therapist can see it at all.
    expect(queue.data).toHaveLength(1);
    expect(queue.data[0].id).toBe(sent.id);
    expect(queue.data[0].reference).toBe(sent.reference);
  });

  it('carries the client identity, which the client-facing record does not', async () => {
    await asClient();
    await therapistsApi.requestAssignment('Please take my case.', 'therapist-1');

    await asTherapist();
    const [incoming] = (await careQueueApi.list()).data;

    expect(incoming.clientName).toBe('UI Tester');
    expect(incoming.clientId).toBe('ui-test-user');
    expect(incoming.reason).toBe('Please take my case.');
  });

  it('leaves an unnamed request out of the queue, since nobody was asked', async () => {
    await asClient();
    await therapistsApi.requestAssignment('Match me with anyone.');

    await asTherapist();
    expect((await careQueueApi.list()).data).toHaveLength(0);
  });

  it('does not show a therapist requests naming someone else', async () => {
    await asClient();
    await therapistsApi.requestAssignment('Work with me?', 'therapist-2');

    await asTherapist();
    expect((await careQueueApi.list()).data).toHaveLength(0);
  });

  it('shows the client the acceptance on their own request', async () => {
    await asClient();
    const sent = await therapistsApi.requestAssignment('Work with me?', 'therapist-1');

    await asTherapist();
    const accepted = await careQueueApi.accept(sent.id);
    expect(accepted.status).toBe('accepted');

    await asClient();
    const tracked = await therapistsApi.getRequest(sent.id);
    // One trail, read from both sides — not two accounts of the same case.
    expect(tracked.status).toBe('accepted');
    expect(tracked.events).toHaveLength(2);
    expect(tracked.events.at(-1)?.label).toContain('accepted your request');
  });

  it('records a decline as a step so the client learns why it stopped', async () => {
    await asClient();
    const sent = await therapistsApi.requestAssignment('Work with me?', 'therapist-1');

    await asTherapist();
    const declined = await careQueueApi.decline(sent.id);
    expect(declined.status).toBe('declined');

    await asClient();
    const tracked = await therapistsApi.getRequest(sent.id);
    expect(tracked.status).toBe('declined');
    expect(tracked.events.at(-1)?.status).toBe('declined');
  });

  it('reports the true status when the request was already answered', async () => {
    await asClient();
    const sent = await therapistsApi.requestAssignment('Work with me?', 'therapist-1');

    await asTherapist();
    await careQueueApi.accept(sent.id);

    // A second tap, or a stale screen, must not read as a fresh failure.
    await expect(careQueueApi.accept(sent.id)).rejects.toMatchObject({
      code: 'request_not_actionable',
      meta: { status: 'accepted' },
    });
  });

  it('will not let a therapist answer a request the client withdrew', async () => {
    await asClient();
    const sent = await therapistsApi.requestAssignment('Work with me?', 'therapist-1');
    await therapistsApi.cancelRequest(sent.id);

    await asTherapist();
    await expect(careQueueApi.accept(sent.id)).rejects.toMatchObject({
      code: 'request_not_actionable',
      meta: { status: 'cancelled' },
    });
  });

  it('refuses an accept without an active plan, rather than trusting the screen', async () => {
    await asClient();
    const sent = await therapistsApi.requestAssignment('Work with me?', 'therapist-1');

    const therapistUser = users.find((u) => u.id === 'user-1')!;
    const plan = therapistUser.therapistProfile;
    therapistUser.therapistProfile = { ...plan!, status: 'inactive' };

    try {
      await asTherapist();
      await expect(careQueueApi.accept(sent.id)).rejects.toMatchObject({
        code: 'therapist_plan_required',
      });
      // Declining is not gated: passing on a case takes no plan slot.
      await expect(careQueueApi.decline(sent.id)).resolves.toMatchObject({ status: 'declined' });
    } finally {
      therapistUser.therapistProfile = plan;
    }
  });

  it('returns an empty queue for a user who does not practise as a therapist', async () => {
    await asClient();
    // Not a 403: an account with no therapist profile simply has nothing waiting.
    expect((await careQueueApi.list()).data).toHaveLength(0);
  });
});
