import { describe, expect, it } from 'vitest';
import {
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
