import { createRouter, createWebHistory } from '@ionic/vue-router';
import { useAuthStore } from '@/stores/auth';
import routes from './routes';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

/**
 * Capability-based nav guard (README §guardrails: the server enforces, the
 * client only hides). Order matters: hydrate the session once, then apply
 * guest/auth/role checks against the now-current auth state.
 */
router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.hydrated) await auth.hydrate();

  if (to.meta.requiresGuest && auth.isAuthenticated) {
    return { name: 'tabs-home' };
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'welcome' };
  }

  const requiredRole = to.meta.requiresRole as string | undefined;
  if (requiredRole && !auth.roles.includes(requiredRole as never)) {
    return { name: 'tabs-home' };
  }

  return true;
});

export default router;
