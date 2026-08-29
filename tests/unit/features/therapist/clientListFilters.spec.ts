import { describe, expect, it } from 'vitest';
import {
  countFor,
  filterClients,
  isPast,
  matchesFilter,
  matchesQuery,
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
  it('flags a client scheduled for a session', () => {
    expect(needsFollowUp(caseFile({ nextSessionAt: '2026-09-01T10:00:00Z' }))).toBe(true);
  });

  it('flags a client who has been sent notes', () => {
    expect(
      needsFollowUp(
        caseFile({
          notes: [{ id: 'n1', authorId: 't1', body: 'Stretch daily.', createdAt: '2026-08-01', draft: false }],
        }),
      ),
    ).toBe(true);
  });

  it('leaves a client with neither out', () => {
    expect(needsFollowUp(caseFile({ nextSessionAt: null, notes: [] }))).toBe(false);
  });

  it('never flags a past client, who is owed nothing', () => {
    expect(
      needsFollowUp(caseFile({ status: 'closed', nextSessionAt: '2026-09-01T10:00:00Z' })),
    ).toBe(false);
  });
});

describe('the three filters together', () => {
  // Nothing scheduled and no notes — active, but nothing to come back to.
  const active = caseFile({ id: 'a', sessionCount: 2 });
  const waiting = caseFile({ id: 'b', nextSessionAt: '2026-09-01T10:00:00Z' });
  const past = caseFile({ id: 'c', status: 'closed' });
  const all = [active, waiting, past];

  it('counts a client needing follow-up in Active as well', () => {
    // TD4 shows the flagged client inside the Active list, so the tabs are not
    // a partition and the counts deliberately overlap.
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

describe('matchesQuery', () => {
  const sandra = caseFile({ clientName: 'Sandra Adams' });

  it('matches on a surname, not just the start of the name', () => {
    expect(matchesQuery(sandra, 'adams')).toBe(true);
  });

  it('ignores case and surrounding space', () => {
    expect(matchesQuery(sandra, '  SANDRA ')).toBe(true);
  });

  it('does not match a different client', () => {
    expect(matchesQuery(sandra, 'tunde')).toBe(false);
  });

  it('matches everything on an empty query', () => {
    expect(matchesQuery(sandra, '   ')).toBe(true);
  });

  it('excludes a case file with no name rather than matching it', () => {
    // A fresh file the server has not named would otherwise appear in every
    // search, which is worse than not being findable by name yet.
    expect(matchesQuery(caseFile({ clientName: undefined }), 'adams')).toBe(false);
  });

  it('narrows the filtered list', () => {
    const list = [sandra, caseFile({ id: 'b', clientName: 'Tunde Ajayi' })];

    expect(filterClients(list, 'active', 'tunde').map((c) => c.clientName)).toEqual(['Tunde Ajayi']);
  });
});
