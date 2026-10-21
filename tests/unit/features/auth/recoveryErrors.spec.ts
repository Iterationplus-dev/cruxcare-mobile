import { describe, expect, it } from 'vitest';
import { recoveryErrorState } from '@/features/auth/recoveryErrors';
import { ApiError } from '@/types/api';

const AMBIGUOUS_PHONE =
  'That phone number is linked to more than one account. Accounts sharing a phone number can only reset their password by email — please enter your email address instead.';
const PHONE_SHARED =
  'This phone number is linked to more than one account, so the password can only be reset by email. Please choose email instead.';

describe('recovery error state', () => {
  it('asks for an email after a shared phone was typed', () => {
    const error = new ApiError(422, { code: 'identifier_ambiguous', message: AMBIGUOUS_PHONE });
    expect(recoveryErrorState(error, '+234 801 234 5678')).toEqual({
      kind: 'identifier_ambiguous',
      message: AMBIGUOUS_PHONE,
      identifierLabel: 'Email address',
    });
  });

  it('asks for a username after a shared email was typed', () => {
    const error = new ApiError(422, {
      code: 'identifier_ambiguous',
      message: 'That email address is linked to more than one account. Please use your username instead.',
    });
    expect(recoveryErrorState(error, 'a@example.com')).toMatchObject({ identifierLabel: 'Username' });
  });

  it('limits the channels to the ones the API allows', () => {
    const error = new ApiError(422, {
      code: 'phone_shared',
      message: PHONE_SHARED,
      meta: { allowedChannels: ['email'] },
    });
    expect(recoveryErrorState(error, 'a@example.com')).toEqual({
      kind: 'phone_shared',
      message: PHONE_SHARED,
      allowedChannels: ['email'],
    });
  });

  it('falls back to email when allowedChannels is missing or unknown', () => {
    const missing = new ApiError(422, { code: 'phone_shared', message: PHONE_SHARED });
    const unknown = new ApiError(422, { code: 'phone_shared', message: PHONE_SHARED, meta: { allowedChannels: ['fax'] } });
    expect(recoveryErrorState(missing, 'x')).toMatchObject({ allowedChannels: ['email'] });
    expect(recoveryErrorState(unknown, 'x')).toMatchObject({ allowedChannels: ['email'] });
  });

  it('leaves every other failure to the generic handler', () => {
    expect(recoveryErrorState(new ApiError(422, { code: 'otp_cooldown', message: 'Wait' }), 'x')).toBeNull();
    expect(recoveryErrorState(new ApiError(500, { code: 'phone_shared', message: 'x' }), 'x')).toBeNull();
    expect(recoveryErrorState(new Error('boom'), 'x')).toBeNull();
  });
});
