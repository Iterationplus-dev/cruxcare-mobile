import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { authApi, type RegisterPayload } from '@/api/auth.api';
import { setAuthTokenGetter, setUnauthorizedHandler } from '@/api/client';
import { secureStorage, SECURE_STORAGE_KEYS } from '@/services/secureStorage';
import type { Capability, Role, TherapistPlanTier, User } from '@/types/user';

/**
 * Session + current-user profile in one store: the "user" is always the
 * subject of the active session, so a second `user` store would just be
 * two places that need to agree with each other.
 */
export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  const user = ref<User | null>(null);
  const hydrated = ref(false);
  /** Which dashboard context is active for a multi-role account (client/therapist/admin). */
  const activeRole = ref<Role>('client');

  const isAuthenticated = computed(() => !!token.value && !!user.value);
  const roles = computed<Role[]>(() => user.value?.roles ?? []);
  /** Contexts with their own dashboard per README IA — "member" surfaces inside client, not its own. */
  const availableRoleContexts = computed<Role[]>(() =>
    (['client', 'therapist', 'admin'] as Role[]).filter((r) => roles.value.includes(r)),
  );

  function hasCapability(capability: Capability): boolean {
    return user.value?.capabilities.includes(capability) ?? false;
  }

  async function persistToken(value: string | null) {
    token.value = value;
    if (value) await secureStorage.set(SECURE_STORAGE_KEYS.authToken, value);
    else await secureStorage.remove(SECURE_STORAGE_KEYS.authToken);
  }

  async function clearSession() {
    await persistToken(null);
    user.value = null;
    activeRole.value = 'client';
  }

  setAuthTokenGetter(() => token.value);
  setUnauthorizedHandler(() => {
    void clearSession();
  });

  /** Call once at app bootstrap — restores a session from secure storage, if any. */
  async function hydrate() {
    if (hydrated.value) return;
    const stored = await secureStorage.get(SECURE_STORAGE_KEYS.authToken);
    if (stored) {
      token.value = stored;
      try {
        user.value = await authApi.me();
      } catch {
        await clearSession();
      }
    }
    hydrated.value = true;
  }

  async function register(payload: RegisterPayload) {
    const session = await authApi.register(payload);
    user.value = session.user;
    await persistToken(session.token);
  }

  async function login(identifier: string, password: string, keepLoggedIn = true) {
    const session = await authApi.login(identifier, password);
    user.value = session.user;
    if (keepLoggedIn) {
      await persistToken(session.token);
    } else {
      token.value = session.token;
      await secureStorage.remove(SECURE_STORAGE_KEYS.authToken);
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      await clearSession();
    }
  }

  async function linkMembership(cruxId: string) {
    user.value = await authApi.linkMembership(cruxId);
  }

  async function activateTherapist(plan: TherapistPlanTier) {
    user.value = await authApi.activateTherapist(plan);
  }

  async function enableBiometric() {
    await authApi.enableBiometric();
    if (user.value) user.value.biometricEnabled = true;
  }

  function setActiveRole(role: Role) {
    if (availableRoleContexts.value.includes(role)) activeRole.value = role;
  }

  return {
    token,
    user,
    hydrated,
    activeRole,
    isAuthenticated,
    roles,
    availableRoleContexts,
    hasCapability,
    hydrate,
    register,
    login,
    logout,
    linkMembership,
    activateTherapist,
    enableBiometric,
    setActiveRole,
  };
});
