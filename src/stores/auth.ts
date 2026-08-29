import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { authApi, type RegisterPayload } from '@/api/auth.api';
import { setAuthTokenGetter, setUnauthorizedHandler } from '@/api/client';
import { secureStorage, SECURE_STORAGE_KEYS } from '@/services/secureStorage';
import { ApiError } from '@/types/api';
import { disablePushNotifications } from '@/services/push/pushNotifications';
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
  /**
   * The session is real but the account has not verified its email. Kept apart
   * from a failed session: the token is good, and throwing it away would strand
   * the account at Welcome with no route to the one thing that fixes it.
   */
  const verificationRequired = ref(false);
  /** Which dashboard context is active for a multi-role account (client/therapist/admin). */
  const activeRole = ref<Role>('client');

  const isAuthenticated = computed(() => !!token.value && !!user.value);
  const roles = computed<Role[]>(() => user.value?.roles ?? []);
  /** Contexts with their own dashboard per the product information architecture. */
  const availableRoleContexts = computed<Role[]>(() =>
    (['member', 'client', 'therapist', 'admin'] as Role[]).filter((r) => roles.value.includes(r)),
  );

  function hasCapability(capability: Capability): boolean {
    return user.value?.capabilities.includes(capability) ?? false;
  }

  /**
   * A therapist is only subscribed with a plan on an active profile. Accounts
   * that held the role before plan selection existed come back as
   * `{ plan: null, status: 'inactive' }`, and an expired plan lapses the same
   * way — both need to choose a plan before taking clients.
   */
  const therapistPlanActive = computed(
    () => !!user.value?.therapistProfile?.plan && user.value.therapistProfile.status === 'active',
  );
  const needsTherapistPlan = computed(
    () => roles.value.includes('therapist') && !therapistPlanActive.value,
  );

  /**
   * Which dashboard a session opens in. A therapist's practice is the surface
   * they signed in to work from, so they start there rather than in the client
   * shell; everyone else opens as client and switches from Profile.
   */
  function defaultRoleContext(value: User | null): Role {
    return value?.roles.includes('therapist') ? 'therapist' : 'client';
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
    verificationRequired.value = false;
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
        activeRole.value = defaultRoleContext(user.value);
        verificationRequired.value = false;
      } catch (error) {
        // An unverified account is not a broken session. Hold the token so the
        // router can send them to verification, which is the only way out.
        if (error instanceof ApiError && error.code === 'signup_verification_required') {
          verificationRequired.value = true;
        } else {
          await clearSession();
        }
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
    activeRole.value = defaultRoleContext(session.user);
    if (keepLoggedIn) {
      await persistToken(session.token);
    } else {
      token.value = session.token;
      await secureStorage.remove(SECURE_STORAGE_KEYS.authToken);
    }
  }

  async function refreshUser() {
    user.value = await authApi.me();
    verificationRequired.value = false;
    return user.value;
  }

  async function changeSignupEmail(email: string) {
    const delivery = await authApi.changeSignupEmail(email);
    if (user.value) {
      user.value = { ...user.value, email, emailVerified: false };
    }
    return delivery;
  }

  async function logout() {
    try {
      // Revoke the push registration while the token is still valid — after
      // the session is cleared the API call would 401 and this handset would
      // keep receiving the departing user's notifications.
      await disablePushNotifications();
      await authApi.logout();
    } finally {
      await clearSession();
    }
  }

  async function linkMembership(cruxId: string) {
    user.value = await authApi.linkMembership(cruxId);
  }

  async function activateTherapist(plan: TherapistPlanTier, paymentToken: string) {
    const result = await authApi.activateTherapist(plan, paymentToken);

    // A pending gateway payment leaves the account exactly as it was: no plan,
    // no role, so nothing about the session may change here.
    if (result.status === 'pending_payment') return result;

    user.value = result.user;
    // Onboarding hands off to the therapist dashboard — keep the context that
    // Profile reports in step with the shell they are about to land in.
    activeRole.value = defaultRoleContext(user.value);
    return result;
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
    verificationRequired,
    activeRole,
    isAuthenticated,
    roles,
    availableRoleContexts,
    therapistPlanActive,
    needsTherapistPlan,
    hasCapability,
    hydrate,
    register,
    login,
    refreshUser,
    changeSignupEmail,
    logout,
    linkMembership,
    activateTherapist,
    enableBiometric,
    setActiveRole,
  };
});
