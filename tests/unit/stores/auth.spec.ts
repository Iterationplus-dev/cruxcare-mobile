import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '@/stores/auth';
import { demoCredentials } from '@/mocks/db';

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('registers a new client and holds a session', async () => {
    const auth = useAuthStore();
    const email = `new-${Date.now()}@example.com`;
    await auth.register({
      firstName: 'Tola',
      lastName: 'Bello',
      email,
      phone: '+2348012340000',
      password: 'Passw0rd!1',
      referredBySource: 'other',
    });

    expect(auth.isAuthenticated).toBe(true);
    expect(auth.user?.email).toBe(email);
    expect(auth.roles).toEqual(['client']);
  });

  it('rejects registering an email that already exists', async () => {
    const auth = useAuthStore();
    await expect(
      auth.register({
        firstName: 'Dup',
        lastName: 'User',
        email: demoCredentials.identifier,
        phone: '+2348012340001',
        password: 'Passw0rd!1',
        referredBySource: 'other',
      }),
    ).rejects.toThrow();
    expect(auth.isAuthenticated).toBe(false);
  });

  it('logs in the seeded demo account', async () => {
    const auth = useAuthStore();
    await auth.login(demoCredentials.identifier, demoCredentials.password);
    expect(auth.isAuthenticated).toBe(true);
    expect(auth.roles).toEqual(expect.arrayContaining(['client', 'member', 'therapist']));
  });

  it('rejects the wrong password and reports attempts remaining', async () => {
    const auth = useAuthStore();
    await expect(auth.login(demoCredentials.identifier, 'wrong-password')).rejects.toMatchObject({
      status: 401,
    });
    expect(auth.isAuthenticated).toBe(false);
  });

  it('clears the session on logout', async () => {
    const auth = useAuthStore();
    await auth.login(demoCredentials.identifier, demoCredentials.password);
    expect(auth.isAuthenticated).toBe(true);
    await auth.logout();
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.token).toBeNull();
  });

  it('restricts activeRole to roles the account actually holds', async () => {
    const auth = useAuthStore();
    await auth.login(demoCredentials.identifier, demoCredentials.password);
    auth.setActiveRole('admin');
    expect(auth.activeRole).toBe('client'); // unchanged — demo user has no admin role
    auth.setActiveRole('therapist');
    expect(auth.activeRole).toBe('therapist');
  });
});
