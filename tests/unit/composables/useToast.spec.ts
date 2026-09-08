import { afterEach, describe, expect, it, vi } from 'vitest';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';

const feedback = useToast();

function dismissAll() {
  while (feedback.active.value) feedback.dismiss();
}

afterEach(() => {
  dismissAll();
  vi.useRealTimers();
});

describe('useToast feedback sheets', () => {
  it('maps success, warning, and error feedback to actionable sheet content', async () => {
    await feedback.show('Profile saved.', 'success');
    expect(feedback.active.value).toMatchObject({
      tone: 'success',
      title: 'All set',
      dismissLabel: 'Done',
    });

    feedback.dismiss();
    await feedback.show('Enter your password.', 'warning', { title: 'Check your details' });
    expect(feedback.active.value).toMatchObject({ tone: 'warning', title: 'Check your details' });

    feedback.dismiss();
    await feedback.show('Invalid credentials.', 'danger', { title: 'Login failed', dismissLabel: 'Try again' });
    expect(feedback.active.value).toMatchObject({
      tone: 'danger',
      title: 'Login failed',
      dismissLabel: 'Try again',
    });
  });

  it('takes the message and the reference off an ApiError', async () => {
    const error = new ApiError(
      500,
      { message: 'SQLSTATE[42S02]: Base table or view not found' },
      'D250B5A6D5BA',
    );

    await feedback.show(error, 'danger', { title: 'Not updated' });

    expect(feedback.active.value?.message).not.toContain('SQLSTATE');
    expect(feedback.active.value?.reference).toBe('D250B5A6D5BA');
  });

  it('shows no reference for a plain string, which has nothing to correlate', async () => {
    await feedback.show('We could not reach the server.', 'danger');

    expect(feedback.active.value?.reference).toBeUndefined();
  });

  it('queues feedback instead of losing a second message', async () => {
    await feedback.show('First message.', 'success');
    await feedback.show('Second message.', 'warning');

    expect(feedback.active.value?.message).toBe('First message.');
    feedback.dismiss();
    expect(feedback.active.value?.message).toBe('Second message.');
  });

  it('auto-dismisses only when a duration is requested', async () => {
    vi.useFakeTimers();
    await feedback.show('Press back again to exit.', 'info', 2000);

    vi.advanceTimersByTime(2000);
    expect(feedback.active.value).toBeNull();
  });
});
