import { describe, expect, it } from 'vitest';
import {
  canRespondToRequest,
  presentIncomingRequest,
} from '@/features/therapist/careQueuePresentation';
import { presentCareRequest } from '@/features/care/careRequestPresentation';

describe('presentIncomingRequest', () => {
  it('puts a new request on the therapist as something to answer', () => {
    const presentation = presentIncomingRequest('submitted');
    expect(presentation.label).toBe('New');
    expect(presentation.actionable).toBe(true);
  });

  it('reads in-review as waiting on the therapist, not on CruxCare', () => {
    const therapistView = presentIncomingRequest('in-review');
    const clientView = presentCareRequest('in-review');

    // Same status, two audiences: the therapist is the one holding it up.
    expect(therapistView.label).toBe('Waiting on you');
    expect(therapistView.actionable).toBe(true);
    expect(clientView.label).toBe('In review');
  });

  it('stops offering an answer once the request has been decided', () => {
    expect(presentIncomingRequest('accepted').actionable).toBe(false);
    expect(presentIncomingRequest('declined').actionable).toBe(false);
    expect(presentIncomingRequest('closed').actionable).toBe(false);
  });

  it('describes a client withdrawal from the therapist side', () => {
    const presentation = presentIncomingRequest('cancelled');
    expect(presentation.label).toBe('Withdrawn');
    expect(presentation.summary).toContain('client withdrew');
  });

  it('renders an unknown status but refuses to act on it', () => {
    const therapistView = presentIncomingRequest('escalated-to-supervisor');

    expect(therapistView.label).toBe('In progress');
    expect(therapistView.tone).toBe('default');
    // Deliberately the opposite of the client rule: an unrecognised status
    // there leaves a Withdraw button, which is at worst refused. Here it would
    // offer to take on a case whose real state the app cannot name.
    expect(therapistView.actionable).toBe(false);
    expect(presentCareRequest('escalated-to-supervisor').open).toBe(true);
  });
});

describe('canRespondToRequest', () => {
  it('offers accept and decline only while the request is unanswered', () => {
    expect(canRespondToRequest('submitted')).toBe(true);
    expect(canRespondToRequest('in-review')).toBe(true);
    expect(canRespondToRequest('accepted')).toBe(false);
    expect(canRespondToRequest('cancelled')).toBe(false);
  });
});
