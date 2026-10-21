import { describe, expect, it } from 'vitest';
import { moneyRefusal, withdrawalWindowRefusal } from '@/features/wallet/moneyActionErrors';
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

describe('the earnings refusals', () => {
  it('explains a loyalty purse that is not open yet, in its own terms', () => {
    const refusal = moneyRefusal(
      new ApiError(422, {
        message: 'Loyalty opens at 100 USD.',
        code: 'loyalty_minimum_not_met',
        meta: { required: 100, available: 21, currency: 'USD' },
      }),
    );

    // The floor is on the balance, not the request, so the copy compares the
    // two figures rather than talking about the amount asked for.
    expect(refusal?.title).toContain('not open yet');
    expect(refusal?.message).toContain('$100.00');
    expect(refusal?.message).toContain('$21.00');
  });

  it('names what is still clearing instead of saying insufficient funds', () => {
    const refusal = moneyRefusal(
      new ApiError(422, {
        message: 'That is more than has cleared in this wallet.',
        code: 'insufficient_funds',
        meta: { wallet: 'cash', available: 0, pending: 66.15, currency: 'USD' },
      }),
    );

    // Saying "insufficient funds" to somebody looking at money on their own
    // screen is how a correct refusal becomes a support ticket.
    expect(refusal?.message).toContain('$66.15');
    expect(refusal?.message).toContain('still clearing');
  });

  it('falls back when there is nothing pending to name', () => {
    const refusal = moneyRefusal(
      new ApiError(422, {
        message: 'Not enough in that wallet.',
        code: 'insufficient_funds',
        meta: { wallet: 'cash', available: 0, pending: 0, currency: 'USD' },
      }),
    );

    expect(refusal?.title).toBe('Not enough in that wallet');
    expect(refusal?.message).toBe('Not enough in that wallet.');
  });

  it('refuses a purse that does not pay out without offering to wait', () => {
    const refusal = moneyRefusal(
      new ApiError(422, {
        message: 'E-wallet cannot be paid out to a bank account.',
        code: 'wallet_not_withdrawable',
        meta: { wallet: 'ewallet' },
      }),
    );

    expect(refusal?.title).toContain('does not pay out');
  });
});

describe('withdrawalWindowRefusal', () => {
  it('recognises a shut window at any status, since both calls check it', () => {
    // Minted at 23:58 on a Friday, settled on Saturday: the quote call and the
    // action call can each be the one that refuses.
    const closed = new ApiError(422, {
      message: 'Withdrawal requests are taken Tuesday to Friday.',
      code: 'withdrawal_window_closed',
    });

    expect(withdrawalWindowRefusal(closed)?.title).toContain('closed');
    expect(withdrawalWindowRefusal(closed)?.message).toContain('Tuesday to Friday');
  });

  it('leaves every other failure alone', () => {
    // It is not a refusal about the money, so it must not swallow ones that are.
    expect(withdrawalWindowRefusal(THRESHOLD)).toBeNull();
    expect(withdrawalWindowRefusal(new Error('offline'))).toBeNull();
  });
});
