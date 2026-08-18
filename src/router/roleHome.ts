import type { Role } from '@/types/user';

/**
 * Landing route for each dashboard context. Every role context owns a shell
 * (README IA: separate dashboards, not extra tabs on the client bar), so
 * "go home" means a different route depending on who is signed in — keep the
 * mapping here rather than hard-coding 'tabs-home' at each call site.
 */
export function homeRouteForRole(role: Role): string {
  if (role === 'therapist') return 'therapist-today';
  if (role === 'admin') return 'admin-approvals';
  if (role === 'member') return 'tabs-member-home';
  return 'tabs-home';
}
