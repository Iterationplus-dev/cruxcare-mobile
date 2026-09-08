import { describe, expect, it } from 'vitest';
import {
  healthAccessRequestRefusal,
  healthProfileAccessView,
} from '@/features/therapist/healthProfileAccess';
import { ApiError } from '@/types/api';
import type { CaseFileHealthAccess } from '@/types/care';

const access = (over: Partial<CaseFileHealthAccess> = {}): CaseFileHealthAccess => ({
  status: 'not-requested',
  reason: null,
  requestedAt: null,
  respondedAt: null,
  ...over,
});

describe('healthProfileAccessView', () => {
  it('offers the ask only where asking can achieve something', () => {
    expect(healthProfileAccessView(access({ status: 'not-requested' })).canRequest).toBe(true);
    // Re-asking is allowed for as long as the client keeps them on the case.
    expect(healthProfileAccessView(access({ status: 'revoked' })).canRequest).toBe(true);
    // A second ask does not make the first one arrive.
    expect(healthProfileAccessView(access({ status: 'pending' })).canRequest).toBe(false);
    expect(healthProfileAccessView(access({ status: 'granted' })).canRequest).toBe(false);
  });

  it('reads a server older than §15.5 as never asked, not as refused', () => {
    const view = healthProfileAccessView(undefined);

    expect(view.kind).toBe('not-requested');
    expect(view.canRequest).toBe(true);
    expect(view.showsProfile).toBe(false);
  });

  it('fetches the profile only once access is granted', () => {
    expect(healthProfileAccessView(access({ status: 'granted' })).showsProfile).toBe(true);
    for (const status of ['not-requested', 'pending', 'revoked'] as const) {
      expect(healthProfileAccessView(access({ status })).showsProfile).toBe(false);
    }
  });

  it('blames the plan, never the client, when the plan is what lapsed', () => {
    const view = healthProfileAccessView(
      access({ status: 'granted' }),
      new ApiError(404, { message: 'Not found.', code: 'plan_lapsed' }),
    );

    expect(view.kind).toBe('lapsed');
    expect(view.title).toContain('plan');
    // §13.3: saying the client withdrew would be untrue and alarming. Naming
    // clients in general is fine — it is the accusation that is forbidden.
    expect(view.message).not.toMatch(/revoked|withdraw|refus|this client/i);
    expect(view.canRequest).toBe(false);
  });

  it('lets the later read overrule a case file that still says granted', () => {
    const stale = access({ status: 'granted' });

    const revoked = healthProfileAccessView(
      stale,
      new ApiError(403, { message: 'Not shared.', code: 'access_revoked' }),
    );

    expect(revoked.kind).toBe('revoked');
    expect(revoked.showsProfile).toBe(false);
    expect(revoked.canRequest).toBe(true);
  });

  it('does not report a dropped connection as a consent decision', () => {
    const view = healthProfileAccessView(access({ status: 'granted' }), new Error('network down'));

    expect(view.kind).toBe('unavailable');
    expect(view.message).not.toMatch(/shared|withdraw|refus/i);
    expect(view.canRequest).toBe(false);
  });

  it('shows the profile when a granted read succeeded', () => {
    const view = healthProfileAccessView(access({ status: 'granted' }), null);

    expect(view.kind).toBe('granted');
    expect(view.showsProfile).toBe(true);
  });
});

describe('healthAccessRequestRefusal', () => {
  it('treats both 409s as a stale screen rather than a failure', () => {
    const pending = healthAccessRequestRefusal(
      new ApiError(409, { message: 'Already asked.', code: 'access_already_requested' }),
    );
    const granted = healthAccessRequestRefusal(
      new ApiError(409, { message: 'Already granted.', code: 'access_already_granted' }),
    );

    expect(pending).toMatch(/already asked/i);
    expect(granted).toMatch(/already shared/i);
  });

  it('falls back to a plain sentence when the failure is not an API error', () => {
    expect(healthAccessRequestRefusal(new Error('socket hang up'))).toMatch(/try again/i);
  });
});
