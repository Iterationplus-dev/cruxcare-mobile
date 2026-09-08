import { ApiError } from '@/types/api';

export interface VideoJoinProblem {
  title: string;
  message: string;
  /** Whether offering "Try again" is honest, or whether the door is shut. */
  retryable: boolean;
}

function timeOf(meta: Record<string, unknown> | undefined, key: string): string | null {
  const value = meta?.[key];
  if (typeof value !== 'string') return null;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Why a video session could not be joined, in words for the person holding the
 * phone. The codes are named rather than lumped together because they call for
 * different things: one is a wait, one is a retry, and one means the button
 * should never have been there.
 */
export function videoJoinProblem(error: unknown): VideoJoinProblem {
  if (!(error instanceof ApiError)) {
    return {
      title: 'Could not connect',
      message: 'Check your connection and try again.',
      retryable: true,
    };
  }

  switch (error.code) {
    case 'outside_session_window': {
      const opensAt = timeOf(error.meta, 'opensAt');
      return {
        title: opensAt ? 'Not open yet' : 'Outside the session time',
        // The time is the useful part; the refusal is not.
        message: opensAt
          ? `You can join from ${opensAt}. The room opens 15 minutes before the session.`
          : error.message,
        retryable: false,
      };
    }
    case 'session_not_video':
      return {
        title: 'Not a video session',
        message: 'This appointment is not a video visit. Check the appointment for how to attend.',
        retryable: false,
      };
    case 'video_not_configured':
      return {
        title: 'Video is unavailable',
        message: 'Video calling is not switched on for this app yet. Your therapist can reach you another way.',
        retryable: false,
      };
    case 'video_provider_unreachable':
      return {
        title: 'Could not reach the call',
        message: 'The video service is not responding. Try again in a moment.',
        retryable: true,
      };
    default:
      break;
  }

  // A 404 never confirms that a session exists — being told "not a participant"
  // and "no such appointment" apart would leak one from the other.
  if (error.status === 404) {
    return {
      title: 'Session not available',
      message: 'This session is not available on your account. Go back and open it from your appointments.',
      retryable: false,
    };
  }

  return { title: 'Could not connect', message: error.message, retryable: error.status >= 500 };
}
