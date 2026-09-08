import { createRouter, createWebHistory } from '@ionic/vue-router';
import { useAuthStore } from '@/stores/auth';
import { applyDarkScreenIcons, applyLightScreenIcons } from '@/services/statusBar';
import { homeRouteForRole } from './roleHome';
import routes from './routes';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

/**
 * Blur whatever triggered this navigation (e.g. the button just tapped)
 * before the outgoing ion-page gets marked aria-hidden — otherwise the
 * browser blocks that aria-hidden and warns, since a hidden subtree can't
 * contain the focused element.
 */
router.beforeEach(() => {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
});

/**
 * Capability-based nav guard (README §guardrails: the server enforces, the
 * client only hides). Order matters: hydrate the session once, then apply
 * guest/auth/role checks against the now-current auth state.
 */
router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.hydrated) await auth.hydrate();

  // A pending signup token exists only for OTP delivery and verification.
  // Keep it out of every application and guest route until the email code is
  // accepted; the API independently enforces the same restriction.
  const isPendingSignupRoute = to.name === 'register-otp' || to.name === 'register-change-email';

  // The session restored but the server will not serve the account until its
  // email is verified. There is no user object to read an address from, so the
  // OTP screen is sent without one and asks the server for delivery itself.
  if (auth.verificationRequired && !isPendingSignupRoute) {
    return {
      name: 'register-otp',
      query: { purpose: 'signup', channel: 'email', redirect: 'health-profile-gate' },
    };
  }

  if (auth.isAuthenticated && auth.user?.emailVerified === false && !isPendingSignupRoute) {
    return {
      name: 'register-otp',
      query: {
        purpose: 'signup',
        contact: auth.user.email,
        channel: 'email',
        redirect: 'health-profile-gate',
      },
    };
  }

  if (to.meta.requiresGuest && auth.isAuthenticated) {
    return { name: homeRouteForRole(auth.activeRole) };
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'welcome' };
  }

  const requiredRole = to.meta.requiresRole as string | undefined;
  if (requiredRole && !auth.roles.includes(requiredRole as never)) {
    // Their own dashboard, not the client one — activeRole is always a context
    // the account actually holds, so this cannot bounce into another refusal.
    return { name: homeRouteForRole(auth.activeRole) };
  }

  return true;
});

/**
 * Centralized here (rather than per-screen onMounted/onBeforeUnmount) so it
 * fires on every navigation regardless of how a screen is left — Ionic's
 * page-transition/view-caching timing made the per-screen lifecycle hooks
 * unreliable (icons could stay white after leaving a dark screen).
 */
router.afterEach((to) => {
  if (to.meta.darkStatusBar) applyDarkScreenIcons();
  else applyLightScreenIcons();
});

export default router;
