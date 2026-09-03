import { describe, expect, it } from 'vitest';
import { passwordStrength, registerSchema } from '@/features/auth/schemas/register.schema';

const validPayload = {
  firstName: 'Amara',
  lastName: 'Okafor',
  email: 'amara@example.com',
  phone: '8031234567',
  referredBySource: 'friends-family',
  password: 'Passw0rd!',
  confirmPassword: 'Passw0rd!',
  consent: true as const,
};

describe('registerSchema', () => {
  it('accepts a fully valid payload', () => {
    expect(registerSchema.safeParse(validPayload).success).toBe(true);
  });

  it('rejects mismatched passwords', () => {
    const result = registerSchema.safeParse({ ...validPayload, confirmPassword: 'different' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('confirmPassword'))).toBe(true);
    }
  });

  it('rejects an unchecked consent box', () => {
    const result = registerSchema.safeParse({ ...validPayload, consent: false });
    expect(result.success).toBe(false);
  });

  it('rejects a password without a digit', () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      password: 'NoDigitsHere',
      confirmPassword: 'NoDigitsHere',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid referral source', () => {
    const result = registerSchema.safeParse({ ...validPayload, referredBySource: 'carrier-pigeon' });
    expect(result.success).toBe(false);
  });
});

describe('passwordStrength', () => {
  it('scores an empty password as too short', () => {
    expect(passwordStrength('').label).toBe('Too short');
  });

  it('scores a long mixed-case, digit, symbol password as very strong', () => {
    expect(passwordStrength('Aa1!Aa1!').label).toBe('Very strong');
  });
});

describe('the consent box', () => {
  const base = {
    firstName: 'Amara',
    lastName: 'Okafor',
    email: 'amara@example.com',
    phone: '8032148890',
    referredBySource: 'facebook',
    password: 'password1',
    confirmPassword: 'password1',
  };

  function consentError(consent: unknown): string | undefined {
    const result = registerSchema.safeParse({ ...base, consent });
    if (result.success) return undefined;
    return result.error.issues.find((i) => i.path[0] === 'consent')?.message;
  }

  it('says what to do when the box is left unticked', () => {
    // The real case. It used to read "Invalid literal value, expected true",
    // because Zod applies a literal's custom message only when the field is
    // missing — and an unticked box sends false, not nothing.
    expect(consentError(false)).toBe(
      'Please tick the box to agree to the Terms of Service and Privacy Policy.',
    );
  });

  it('says the same thing when the field never arrives', () => {
    // Both routes to failure have to read alike; one of them used to be the
    // machine talking.
    expect(consentError(undefined)).toBe(
      'Please tick the box to agree to the Terms of Service and Privacy Policy.',
    );
  });

  it('accepts a ticked box', () => {
    expect(consentError(true)).toBeUndefined();
  });
});
