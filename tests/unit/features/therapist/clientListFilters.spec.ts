import { describe, expect, it } from 'vitest';
import {
  countFor,
  filterClients,
  isPast,
  matchesFilter,
  needsFollowUp,
} from '@/features/therapist/clientListFilters';
import type { CaseFile } from '@/types/care';

function caseFile(overrides: Partial<CaseFile> = {}): CaseFile {
  return {
    id: 'case-1',
    clientId: 'user-1',
    therapistId: 'therapist-1',
    notes: [],
    recommendations: [],
    status: 'active',
    ...overrides,
  };
}

describe('isPast', () => {
  it('treats settled cases as past, whatever the casing', () => {
    expect(isPast({ status: 'Closed' })).toBe(true);
    expect(isPast({ status: 'rejected' })).toBe(true);
    expect(isPast({ status: 'cancelled' })).toBe(true);
  });

  it('leaves a running case out of Past', () => {
    expect(isPast({ status: 'Active' })).toBe(false);
    expect(isPast({ status: 'new' })).toBe(false);
  });

  it('does not call a case past just because the status is missing', () => {
    expect(isPast({ status: null })).toBe(false);
  });
});

describe('needsFollowUp', () => {
  it('flags an unwritten note', () => {
    expect(needsFollowUp(caseFile({ unwrittenNoteFrom: '2026-07-30T00:00:00Z' }))).toBe(true);
  });

  it('flags a client who has been seen with nothing booked next', () => {
    expect(needsFollowUp(caseFile({ sessionCount: 3, nextSessionAt: null }))).toBe(true);
  });

  it('leaves a client alone when the next session is booked', () => {
    expect(
      needsFollowUp(caseFile({ sessionCount: 3, nextSessionAt: '2026-09-01T10:00:00Z' })),
    ).toBe(false);
  });

  it('does not flag a newly accepted client who has had no sessions', () => {
    // Nothing has lapsed yet — the relationship has only just started.
    expect(needsFollowUp(caseFile({ sessionCount: 0, nextSessionAt: null }))).toBe(false);
  });

  it('never flags a past client, who is not waiting on anything', () => {
    expect(
      needsFollowUp(caseFile({ status: 'closed', unwrittenNoteFrom: '2026-07-30T00:00:00Z' })),
    ).toBe(false);
  });
});

describe('the three filters together', () => {
  const active = caseFile({ id: 'a', sessionCount: 2, nextSessionAt: '2026-09-01T10:00:00Z' });
  const waiting = caseFile({ id: 'b', unwrittenNoteFrom: '2026-07-30T00:00:00Z' });
  const past = caseFile({ id: 'c', status: 'closed' });
  const all = [active, waiting, past];

  it('counts a client needing follow-up in Active as well', () => {
    // TD4 shows the unwritten-note client inside the Active list, so the tabs
    // are not a partition and the counts deliberately overlap.
    expect(countFor(all, 'active')).toBe(2);
    expect(countFor(all, 'needs-follow-up')).toBe(1);
    expect(matchesFilter(waiting, 'active')).toBe(true);
    expect(matchesFilter(waiting, 'needs-follow-up')).toBe(true);
  });

  it('keeps Past exclusive', () => {
    expect(countFor(all, 'past')).toBe(1);
    expect(matchesFilter(past, 'active')).toBe(false);
  });

  it('filters to the rows the count promised', () => {
    expect(filterClients(all, 'active').map((c) => c.id)).toEqual(['a', 'b']);
    expect(filterClients(all, 'past').map((c) => c.id)).toEqual(['c']);
  });

  it('counts nothing before the list has loaded', () => {
    expect(countFor(undefined, 'active')).toBe(0);
    expect(filterClients(undefined, 'active')).toEqual([]);
  });
});
