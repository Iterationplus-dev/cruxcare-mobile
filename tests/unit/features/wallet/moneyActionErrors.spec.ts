import { describe, expect, it } from 'vitest';
import { moneyRefusal } from '@/features/wallet/moneyActionErrors';
import { ApiError } from '@/types/api';

const THRESHOLD = new ApiError(422, {
  message: 'Your balance has not reached the amount required before a withdrawal can be made.',
  code: 'withdrawal_threshold_not_met',
  meta: { required: 500, available: 200, currency: 'USD' },
});

describe('moneyRefusal', () => {
  it('names the floor and what they actually have', () => {
    const refusal = moneyRefusal(THRESHOLD);

    expect(refusal?.message).toContain('$500.00');
    expect(refusal?.message).toContain('$200.00');
  });

  it('takes the currency from the server rather than assuming dollars', () => {
    const naira = new ApiError(422, {
      message: 'Not enough.',
      code: 'withdrawal_threshold_not_met',
      meta: { required: 500000, available: 12000, currency: 'NGN' },
    });

    expect(moneyRefusal(naira)?.message).toContain('₦');
  });

  it('explains a daily cap with the day so far, not just the cap', () => {
    const capped = new ApiError(422, {
      message: 'Daily limit reached.',
      code: 'daily_limit_exceeded',
      meta: { limit: 1000, usedToday: 850, currency: 'USD' },
    });

    const refusal = moneyRefusal(capped);

    expect(refusal?.message).toContain('$1,000.00');
    expect(refusal?.message).toContain('$850.00');
  });

  it('falls back to the server sentence when the figures are missing', () => {
    // A 422 message is written for a person, so it beats inventing copy from
    // half a meta block.
    const partial = new ApiError(422, {
      message: 'Your balance has not reached the required amount.',
      code: 'withdrawal_threshold_not_met',
      meta: { required: 500 },
    });

    expect(moneyRefusal(partial)?.message).toBe('Your balance has not reached the required amount.');
  });

  it('leaves anything that is not an actionable rule to the ordinary path', () => {
    expect(moneyRefusal(new Error('offline'))).toBeNull();
    expect(moneyRefusal(new ApiError(422, { message: 'That quote has expired.' }))).toBeNull();
    // The same code on a server failure is not a rule the member can act on.
    expect(
      moneyRefusal(
        new ApiError(500, { message: 'Boom', code: 'withdrawal_threshold_not_met', meta: { required: 500, available: 1, currency: 'USD' } }),
      ),
    ).toBeNull();
  });
});
