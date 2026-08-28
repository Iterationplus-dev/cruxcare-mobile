import { describe, expect, it } from 'vitest';
import { presentClientRow } from '@/features/therapist/clientListPresentation';
import type { CaseFile } from '@/types/care';

function caseFile(overrides: Partial<CaseFile> = {}): CaseFile {
  return {
    id: 'case-1',
    clientId: 'user-1',
    therapistId: 'therapist-1',
    notes: [],
    recommendations: [],
    ...overrides,
  };
}

/** Fixed, and written in local time: the screen renders in the therapist's
 *  own zone, so a Z-suffixed literal would make these assertions depend on
 *  where the suite runs. */
const now = new Date('2026-08-28T09:00:00');

describe('presentClientRow', () => {
  it('summarises sessions and the next one', () => {
    const row = presentClientRow(
      caseFile({ sessionCount: 12, nextSessionAt: '2026-08-28T10:00:00' }),
      now,
    );

    expect(row.subtitle).toBe('12 sessions · next today 10:00');
    expect(row.tone).toBe('default');
  });

  it('dates a session that is not today', () => {
    const row = presentClientRow(
      caseFile({ sessionCount: 4, nextSessionAt: '2026-09-02T16:00:00' }),
      now,
    );

    // "Sept", not "Sep" — en-GB's short form, and the design's only dated
    // example ("30 Jul") reads the same in either locale, so nothing conflicts.
    expect(row.subtitle).toBe('4 sessions · next 2 Sept 16:00');
  });

  it('says one session, not one sessions', () => {
    expect(presentClientRow(caseFile({ sessionCount: 1 }), now).subtitle).toBe('1 session');
  });

  it('reads zero sessions for a client who has only just been accepted', () => {
    // The case file opens empty, so this is the first thing a therapist sees.
    expect(presentClientRow(caseFile(), now).subtitle).toBe('0 sessions');
  });

  it('replaces the summary when a note is unwritten, and asks for attention', () => {
    const row = presentClientRow(
      caseFile({ sessionCount: 9, nextSessionAt: '2026-08-28T10:00:00', unwrittenNoteFrom: '2026-07-30T11:00:00' }),
      now,
    );

    // The one thing on the row the therapist must act on wins the space.
    expect(row.subtitle).toBe('Note unwritten from 30 Jul');
    expect(row.tone).toBe('attention');
  });

  it('omits the next session when none is booked', () => {
    expect(presentClientRow(caseFile({ sessionCount: 3, nextSessionAt: null }), now).subtitle).toBe(
      '3 sessions',
    );
  });

  it('ignores an unparseable next session rather than rendering Invalid Date', () => {
    const row = presentClientRow(caseFile({ sessionCount: 2, nextSessionAt: 'not-a-date' }), now);

    expect(row.subtitle).toBe('2 sessions');
  });
});
