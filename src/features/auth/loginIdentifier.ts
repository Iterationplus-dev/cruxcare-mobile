interface LoginFailure {
  status: number;
  code?: string;
  message: string;
}

/** Phone numbers are no longer accepted at the login endpoint. */
export function validateLoginIdentifier(value: string): string | null {
  if (!value) return 'Enter your username or email address.';

  const digits = value.replace(/\D/g, '');
  if (/^\+?[\d\s().-]+$/.test(value) && digits.length >= 7) {
    return 'Use your username or email address. Phone numbers cannot be used to log in.';
  }

  return null;
}

/** Preserve generic credential errors, except for the server-approved recovery guidance. */
export function loginFailureMessage(error: LoginFailure): string {
  if (error.status === 401 && error.code === 'use_username') return error.message;
  if (error.status === 401) return 'Username, email, or password is incorrect.';
  if (error.status === 0) return 'We could not reach CruxCare. Check your connection and try again.';
  if (error.status >= 500) return 'Temporary unavailable. Cheek back';
  return error.message;
}
