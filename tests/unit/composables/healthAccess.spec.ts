import { describe, expect, it } from 'vitest';
import { pendingHealthAccess } from '@/composables/useHealthAccess';
import type { HealthProfileAccess } from '@/types/care';

function row(over: Partial<HealthProfileAccess> = {}): HealthProfileAccess {
  return {
    id: 'hpa-1',
    therapistId: 'therapist-1',
    therapistName: 'Amaka Obi',
    clientId: 'user-1',
    status: 'pending',
    reason: null,
    requestedAt: '2026-09-14T10:00:00Z',
    respondedAt: null,
    ...over,
  };
}

describe('pendingHealthAccess', () => {
  it('returns nothing for an empty or absent list', () => {
    expect(pendingHealthAccess([])).toEqual([]);
    expect(pendingHealthAccess(undefined)).toEqual([]);
  });

  it('keeps only requests still waiting on an answer', () => {
    const rows = [
      row({ id: 'a', status: 'pending' }),
      row({ id: 'b', status: 'granted' }),
      row({ id: 'c', status: 'revoked' }),
    ];

    expect(pendingHealthAccess(rows).map((r) => r.id)).toEqual(['a']);
  });

  it('puts the most recent ask first', () => {
    const rows = [
      row({ id: 'old', requestedAt: '2026-09-10T10:00:00Z' }),
      row({ id: 'new', requestedAt: '2026-09-14T10:00:00Z' }),
      row({ id: 'mid', requestedAt: '2026-09-12T10:00:00Z' }),
    ];

    expect(pendingHealthAccess(rows).map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });

  it('does not reorder the caller’s array', () => {
    // The banners read this straight off the query cache, and sorting that
    // array in place would reorder what every other reader sees.
    const rows = [
      row({ id: 'old', requestedAt: '2026-09-10T10:00:00Z' }),
      row({ id: 'new', requestedAt: '2026-09-14T10:00:00Z' }),
    ];

    pendingHealthAccess(rows);

    expect(rows.map((r) => r.id)).toEqual(['old', 'new']);
  });

  it('treats an unrecognised status as not pending', () => {
    // `HealthProfileAccessStatus` is open-ended, so a status this build has
    // never heard of must not be shown to the client as a live question.
    expect(pendingHealthAccess([row({ status: 'expired' })])).toEqual([]);
  });
});
