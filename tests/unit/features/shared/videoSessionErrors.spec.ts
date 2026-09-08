import { describe, expect, it } from 'vitest';
import { videoJoinProblem } from '@/features/shared/videoSessionErrors';
import { ApiError } from '@/types/api';

describe('videoJoinProblem', () => {
  it('renders the time the room opens, not the refusal', () => {
    const opensAt = new Date('2026-09-05T14:45:00Z');
    const error = new ApiError(422, {
      message: 'This session is not open yet.',
      code: 'outside_session_window',
      meta: { opensAt: opensAt.toISOString(), closesAt: '2026-09-05T16:00:00Z' },
    });

    const problem = videoJoinProblem(error);

    expect(problem.message).toContain(
      opensAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
    );
    // Waiting is not retrying — offering a button that cannot work is a lie.
    expect(problem.retryable).toBe(false);
  });

  it('offers a retry only where trying again could work', () => {
    const unreachable = new ApiError(422, {
      message: 'Provider unreachable.',
      code: 'video_provider_unreachable',
    });
    const off = new ApiError(422, { message: 'No video credentials.', code: 'video_not_configured' });

    expect(videoJoinProblem(unreachable).retryable).toBe(true);
    expect(videoJoinProblem(off).retryable).toBe(false);
  });

  it('says nothing about whether someone else’s session exists', () => {
    const problem = videoJoinProblem(
      new ApiError(404, { message: 'That session is not available.', code: 'appointment_not_found' }),
    );

    expect(problem.message).not.toMatch(/not a participant|belongs to/i);
    expect(problem.retryable).toBe(false);
  });

  it('treats a wrong-type session as a state bug the user cannot fix', () => {
    const problem = videoJoinProblem(
      new ApiError(422, {
        message: 'Not a video visit.',
        code: 'session_not_video',
        meta: { type: 'in-person' },
      }),
    );

    expect(problem.retryable).toBe(false);
  });

  it('falls back to a connection message for anything that is not an API error', () => {
    const problem = videoJoinProblem(new Error('socket hang up'));

    expect(problem.retryable).toBe(true);
    expect(problem.message).toContain('connection');
  });
});
