import { describe, expect, it } from 'vitest';
import { loginSucceeded } from '@/features/profile/loginHistory';

describe('loginSucceeded', () => {
  it('matches the word the API actually sends', () => {
    // The server says `succeeded`. Testing for `success` rendered every real
    // sign-in as a failed attempt on the reader's own security screen.
    expect(loginSucceeded('succeeded')).toBe(true);
  });

  it('is false for a failure', () => {
    expect(loginSucceeded('failed')).toBe(false);
  });

  it('treats an unrecognised outcome as a failure, not a success', () => {
    // On a security screen, the safe direction to be wrong in is the one that
    // draws attention rather than the one that reassures.
    expect(loginSucceeded('locked')).toBe(false);
    expect(loginSucceeded('')).toBe(false);
  });
});
