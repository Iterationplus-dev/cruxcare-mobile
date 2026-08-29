import { describe, expect, it } from 'vitest';
import { findStandingRequestTo,
  canCancelCareRequest,
  presentCareRequest,
} from '@/features/care/careRequestPresentation';

describe('presentCareRequest', () => {
  it('marks a submitted request as still open', () => {
    const presentation = presentCareRequest('submitted');
    expect(presentation.label).toBe('Sent');
    expect(presentation.open).toBe(true);
  });

  it('closes out an accepted request with the success tone', () => {
    const presentation = presentCareRequest('accepted');
    expect(presentation.tone).toBe('success');
    expect(presentation.open).toBe(false);
  });

  it('treats a declined request as finished but recoverable', () => {
    const presentation = presentCareRequest('declined');
    expect(presentation.tone).toBe('danger');
    expect(presentation.open).toBe(false);
    expect(presentation.summary).toContain('request someone else');
  });

  it('falls back to an open, neutral treatment for an unknown status', () => {
    const presentation = presentCareRequest('escalated-to-supervisor');
    expect(presentation.label).toBe('In progress');
    expect(presentation.tone).toBe('default');
    // The request exists server-side, so claiming it has finished would say
    // more than the app knows.
    expect(presentation.open).toBe(true);
  });
});

describe('canCancelCareRequest', () => {
  it('allows withdrawing a request that is still moving', () => {
    expect(canCancelCareRequest('submitted')).toBe(true);
    expect(canCancelCareRequest('in-review')).toBe(true);
  });

  it('refuses to offer a withdrawal on a finished request', () => {
    expect(canCancelCareRequest('accepted')).toBe(false);
    expect(canCancelCareRequest('cancelled')).toBe(false);
    expect(canCancelCareRequest('closed')).toBe(false);
  });
});

describe('findStandingRequestTo', () => {
  const req = (therapistId: string, status: string) =>
    ({ therapistId, status }) as { therapistId: string; status: string };

  it('finds a request still being decided', () => {
    const found = findStandingRequestTo([req('t-1', 'in-review')], 't-1');

    expect(found).toMatchObject({ therapistId: 't-1' });
  });

  it('treats an accepted request as standing — that is a relationship, not a queue item', () => {
    expect(findStandingRequestTo([req('t-1', 'accepted')], 't-1')).toBeDefined();
  });

  it('lets the client ask again after a decline', () => {
    expect(findStandingRequestTo([req('t-1', 'declined')], 't-1')).toBeUndefined();
  });

  it('lets the client ask again after withdrawing', () => {
    expect(findStandingRequestTo([req('t-1', 'cancelled')], 't-1')).toBeUndefined();
  });

  it('does not block a different therapist', () => {
    expect(findStandingRequestTo([req('t-1', 'submitted')], 't-2')).toBeUndefined();
  });

  it('is undefined before the requests have loaded', () => {
    expect(findStandingRequestTo(undefined, 't-1')).toBeUndefined();
  });

  it('treats an unknown status as still in progress, so it blocks', () => {
    // Unknown statuses render as "in progress"; asking again would duplicate.
    expect(findStandingRequestTo([req('t-1', 'escalated')], 't-1')).toBeDefined();
  });
});
