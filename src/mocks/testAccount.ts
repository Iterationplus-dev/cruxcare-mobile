/**
 * Credentials for manual UI testing while `VITE_USE_API_MOCKS=true`.
 * This account is intentionally limited to the client journey so it can be
 * used to exercise onboarding, health-profile completion, and care access.
 */
export const uiTestCredentials = {
  identifier: 'ui.test@cruxcare.app',
  password: 'CruxTest!2026',
} as const;
