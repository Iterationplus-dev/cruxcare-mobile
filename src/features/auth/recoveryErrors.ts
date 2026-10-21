import { ApiError } from '@/types/api';

export type RecoveryChannel = 'sms' | 'whatsapp' | 'email';

export const ALL_RECOVERY_CHANNELS: RecoveryChannel[] = ['sms', 'whatsapp', 'email'];

/**
 * How the forgot-password screen answers one of the two 422s an account with a
 * shared phone number gets (both mean no code was sent). Neither is a dead end:
 * the user stays on the screen with the API's own message.
 *
 * - `identifier_ambiguous`: what they typed is on more than one account. Clear
 *   it and ask for something that names one account — an email for a shared
 *   phone, a username for a shared email.
 * - `phone_shared`: the account was found, but its phone is on another account,
 *   so only the channels in `meta.allowedChannels` (email) may be used.
 */
export type RecoveryErrorState =
  | { kind: 'identifier_ambiguous'; message: string; identifierLabel: string }
  | { kind: 'phone_shared'; message: string; allowedChannels: RecoveryChannel[] };

export function recoveryErrorState(error: unknown, typedIdentifier: string): RecoveryErrorState | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null;

  if (error.code === 'identifier_ambiguous') {
    return {
      kind: 'identifier_ambiguous',
      message: error.message,
      identifierLabel: typedIdentifier.includes('@') ? 'Username' : 'Email address',
    };
  }

  if (error.code === 'phone_shared') {
    const listed = Array.isArray(error.meta?.allowedChannels) ? error.meta.allowedChannels : [];
    const allowed = ALL_RECOVERY_CHANNELS.filter((channel) => listed.includes(channel));
    return {
      kind: 'phone_shared',
      message: error.message,
      allowedChannels: allowed.length ? allowed : ['email'],
    };
  }

  return null;
}
