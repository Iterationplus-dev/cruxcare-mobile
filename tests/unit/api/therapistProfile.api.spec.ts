import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { therapistsApi } from '@/api/therapists.api';
import { useAuthStore } from '@/stores/auth';
import { demoCredentials, therapists } from '@/mocks/db';
import { uiTestCredentials } from '@/mocks/testAccount';

vi.mock('@/services/secureStorage', () => ({
  secureStorage: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  SECURE_STORAGE_KEYS: { authToken: 'cc_auth_token', pushInstallationId: 'cc_push_id' },
}));

async function signIn(credentials: { identifier: string; password: string }) {
  setActivePinia(createPinia());
  const auth = useAuthStore();
  await auth.login(credentials.identifier, credentials.password);
  return auth;
}

const asClient = () => signIn(uiTestCredentials);
/** The demo account practises as `therapist-1`. */
const asTherapist = () => signIn(demoCredentials);

describe('therapist areas of specialization', () => {
  const seeded = therapists.find((t) => t.id === 'therapist-1')!.specialties;

  beforeEach(() => {
    therapists.find((t) => t.id === 'therapist-1')!.specialties = [...seeded];
  });

  it('returns the signed-in therapist their own profile', async () => {
    await asTherapist();
    const profile = await therapistsApi.myProfile();

    expect(profile.id).toBe('therapist-1');
    expect(profile.specialties).toEqual(seeded);
  });

  it('saves a replacement list', async () => {
    await asTherapist();
    const updated = await therapistsApi.updateMyProfile({
      specialties: ['Massage therapy', 'Stress and sleep'],
    });

    expect(updated.specialties).toEqual(['Massage therapy', 'Stress and sleep']);

    // Persisted, not just echoed back.
    const refetched = await therapistsApi.myProfile();
    expect(refetched.specialties).toEqual(['Massage therapy', 'Stress and sleep']);
  });

  it('shows the saved list to clients browsing that therapist', async () => {
    await asTherapist();
    await therapistsApi.updateMyProfile({ specialties: ['Herbal medicine'] });

    await asClient();
    const publicProfile = await therapistsApi.get('therapist-1');
    expect(publicProfile.specialties).toEqual(['Herbal medicine']);
  });

  it('accepts an empty list, which clears the profile', async () => {
    await asTherapist();
    const updated = await therapistsApi.updateMyProfile({ specialties: [] });

    expect(updated.specialties).toEqual([]);
  });

  it('stores the normalized form rather than what was typed', async () => {
    await asTherapist();
    const updated = await therapistsApi.updateMyProfile({
      specialties: ['  Sports   rehabilitation  '],
    });

    expect(updated.specialties).toEqual(['Sports rehabilitation']);
  });

  it('rejects a blank entry', async () => {
    await asTherapist();
    await expect(
      therapistsApi.updateMyProfile({ specialties: ['Physiotherapy', '   '] }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('rejects duplicates that differ only by case', async () => {
    await asTherapist();
    await expect(
      therapistsApi.updateMyProfile({ specialties: ['Physiotherapy', 'physiotherapy'] }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('rejects more areas than the limit allows', async () => {
    await asTherapist();
    const tooMany = Array.from({ length: 9 }, (_, i) => `Area ${i}`);

    await expect(
      therapistsApi.updateMyProfile({ specialties: tooMany }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('leaves the stored list untouched when the update is rejected', async () => {
    await asTherapist();
    await expect(
      therapistsApi.updateMyProfile({ specialties: ['ok', '   '] }),
    ).rejects.toMatchObject({ status: 422 });

    expect((await therapistsApi.myProfile()).specialties).toEqual(seeded);
  });

  it('refuses an account that does not practise as a therapist', async () => {
    await asClient();

    await expect(therapistsApi.myProfile()).rejects.toMatchObject({ status: 403 });
    await expect(
      therapistsApi.updateMyProfile({ specialties: ['Anything'] }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
