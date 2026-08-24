import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { therapistsApi } from '@/api/therapists.api';
import { useAuthStore } from '@/stores/auth';
import { demoCredentials, careRequests } from '@/mocks/db';
import { ApiError } from '@/types/api';

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

describe('care requests', () => {
  beforeEach(async () => {
    careRequests.clear();
    await signIn();
  });

  it('returns a trackable request with its first progress step', async () => {
    const created = await therapistsApi.requestAssignment('Please match me.');

    expect(created.reference).toMatch(/^CR-/);
    expect(created.status).toBe('submitted');
    expect(created.therapistId).toBeNull();
    expect(created.events).toHaveLength(1);
    expect(created.events[0].at).toBe(created.createdAt);
  });

  it('attaches the named therapist so the client can see who was asked', async () => {
    const created = await therapistsApi.requestAssignment('Work with me?', 'therapist-1');

    expect(created.therapistId).toBe('therapist-1');
    expect(created.therapistName).toBeTruthy();
    expect(created.events[0].label).toContain(created.therapistName!);
  });

  it('lists the caller own requests, newest first', async () => {
    await therapistsApi.requestAssignment('First request.');
    await therapistsApi.requestAssignment('Second request.');

    const page = await therapistsApi.listRequests();
    expect(page.data).toHaveLength(2);
    expect(page.data[0].reason).toBe('Second request.');
  });

  it('records the withdrawal as a step rather than dropping the request', async () => {
    const created = await therapistsApi.requestAssignment('Please match me.');
    const cancelled = await therapistsApi.cancelRequest(created.id);

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.events).toHaveLength(2);
    expect(cancelled.events.at(-1)?.status).toBe('cancelled');
    // Still listed: the client keeps a record of what they asked for.
    expect((await therapistsApi.listRequests()).data).toHaveLength(1);
  });

  it('opens a named request already in review, since someone has it', async () => {
    const open = await therapistsApi.requestAssignment('Match me with anyone.');
    const named = await therapistsApi.requestAssignment('Work with me?', 'therapist-1');

    // The distinction is "nobody has looked at this" vs "someone has it".
    expect(open.status).toBe('submitted');
    expect(named.status).toBe('in-review');
  });

  it('fetches a request by its reference as well as its id', async () => {
    const created = await therapistsApi.requestAssignment('Please match me.');

    expect((await therapistsApi.getRequest(created.id)).id).toBe(created.id);
    expect((await therapistsApi.getRequest(created.reference)).id).toBe(created.id);
  });

  it('reports the true status when a request can no longer be withdrawn', async () => {
    const created = await therapistsApi.requestAssignment('Please match me.');
    await therapistsApi.cancelRequest(created.id);

    // A retry of the same withdrawal must not look like a fresh failure.
    await expect(therapistsApi.cancelRequest(created.id)).rejects.toMatchObject({
      code: 'request_not_cancellable',
      meta: { status: 'cancelled' },
    });
  });

  it('refuses a request naming a therapist who does not exist', async () => {
    await expect(therapistsApi.requestAssignment('Work with me?', 'therapist-nope')).rejects.toThrow(
      ApiError,
    );
  });
});
