import { describe, expect, it } from 'vitest';
import { loginFailureMessage, validateLoginIdentifier } from '@/features/auth/loginIdentifier';

describe('login identifier', () => {
  it.each(['amaka.obi', 'person@example.com', 'person@member'])('accepts a username or email: %s', (identifier) => {
    expect(validateLoginIdentifier(identifier)).toBeNull();
  });

  it('rejects a phone-number login identifier', () => {
    expect(validateLoginIdentifier('+234 801 234 5678')).toBe(
      'Use your username or email address. Phone numbers cannot be used to log in.',
    );
  });

  it('displays the backend guidance for an ambiguous email', () => {
    expect(
      loginFailureMessage({
        status: 401,
        code: 'use_username',
        message: 'Multiple accounts use this email address. Enter your username to log in.',
      }),
    ).toBe('Multiple accounts use this email address. Enter your username to log in.');
  });

  it('keeps other authentication failures generic', () => {
    expect(loginFailureMessage({ status: 401, code: 'invalid_credentials', message: 'Server detail' })).toBe(
      'Username, email, or password is incorrect.',
    );
  });

  it('does not expose a server exception to the person signing in', () => {
    expect(
      loginFailureMessage({
        status: 500,
        code: 'server_error',
        message: 'Declaration of Carbon\\CarbonPeriod::getIterator(): Generator must be compatible with DatePeriod::getIterator(): Iterator',
      }),
    ).toBe('Temporary unavailable. Cheek back');
  });
});
