import { describe, expect, it } from 'vitest';
import {
  monthGrid,
  monthLabel,
  formatDayHeading,
  openDayIndex,
  slotsFor,
  WEEKDAY_LABELS,
} from '@/features/care/bookingCalendar';

/** Mid-month so "today" is neither the first nor the last day. */
const today = new Date(2026, 7, 29); // 29 August 2026

describe('monthGrid', () => {
  const grid = monthGrid(2026, 7, today);

  it('pads the first week so the 1st lands under its weekday', () => {
    // 1 August 2026 is a Saturday, so Monday-first leaves five blanks.
    const lead = grid.findIndex((c) => c.day === 1);
    expect(lead).toBe(5);
    expect(grid.slice(0, lead).every((c) => c.iso === null)).toBe(true);
  });

  it('covers every day of the month', () => {
    expect(grid.filter((c) => c.day !== null)).toHaveLength(31);
  });

  it('disables days already past', () => {
    const past = grid.find((c) => c.day === 28);
    expect(past?.disabled).toBe(true);
  });

  it('leaves today bookable', () => {
    expect(grid.find((c) => c.day === 29)?.disabled).toBe(false);
  });

  it('leaves future days bookable', () => {
    expect(grid.find((c) => c.day === 31)?.disabled).toBe(false);
  });

  it('builds an iso date that parses back to the same day', () => {
    const cell = grid.find((c) => c.day === 29);
    expect(cell?.iso).toBe('2026-08-29');
  });

  it('handles a month starting on a Monday with no padding', () => {
    // 1 June 2026 is a Monday.
    expect(monthGrid(2026, 5, today)[0].day).toBe(1);
  });

  it('handles February in a leap year', () => {
    expect(monthGrid(2028, 1, today).filter((c) => c.day !== null)).toHaveLength(29);
  });
});

describe('labels', () => {
  it('names the month and year', () => {
    expect(monthLabel(2026, 7)).toBe('August 2026');
  });

  it('reads a day heading the way the design writes it', () => {
    expect(formatDayHeading('2026-08-29')).toBe('Saturday 29 August');
  });

  it('returns nothing for an unusable date rather than "Invalid Date"', () => {
    expect(formatDayHeading('nonsense')).toBe('');
  });

  it('starts the week on Monday', () => {
    expect(WEEKDAY_LABELS[0]).toBe('M');
    expect(WEEKDAY_LABELS).toHaveLength(7);
  });
});


describe('openDayIndex', () => {
  it('keys the availability rows by date', () => {
    const index = openDayIndex([{ date: '2026-09-01', slots: ['09:00'] }]);

    expect(index?.get('2026-09-01')).toEqual(['09:00']);
  });

  it('is undefined while availability is still loading', () => {
    // Distinct from an empty map, which would mean every day is closed.
    expect(openDayIndex(undefined)).toBeUndefined();
  });
});

describe('slotsFor', () => {
  const open = openDayIndex([
    { date: '2026-09-01', slots: ['09:00', '10:00'] },
    { date: '2026-09-02', slots: [] },
  ]);

  it('carries the exact instant the server offered', () => {
    // The server's slots are UTC wall-clock, because that is how the rota is
    // stored. Reading "10:00" as local and sending that back asked for an
    // instant nobody offered: on a UTC+1 device it booked 09:00 UTC.
    expect(slotsFor('2026-09-01', open).map((s) => s.iso)).toEqual([
      '2026-09-01T09:00:00.000Z',
      '2026-09-01T10:00:00.000Z',
    ]);
  });

  it('labels each slot from that same instant', () => {
    // The label and the request come from one value, so the picker cannot show
    // one time and book another.
    for (const slot of slotsFor('2026-09-01', open)) {
      const expected = new Date(slot.iso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      expect(slot.label).toBe(expected);
    }
  });

  it('returns nothing for a closed day rather than a default list', () => {
    // A fixed pattern of times was the invented availability this replaced.
    expect(slotsFor('2026-09-02', open)).toEqual([]);
  });

  it('returns nothing when no day is selected', () => {
    expect(slotsFor(null, open)).toEqual([]);
  });

  it('returns nothing while availability is loading', () => {
    expect(slotsFor('2026-09-01', undefined)).toEqual([]);
  });

  it('drops an unusable time instead of offering an Invalid Date', () => {
    const broken = openDayIndex([{ date: '2026-09-01', slots: ['not-a-time', '09:00'] }]);

    expect(slotsFor('2026-09-01', broken).map((s) => s.iso)).toEqual([
      '2026-09-01T09:00:00.000Z',
    ]);
  });
});

describe('monthGrid with a therapist rota', () => {
  it('closes a day the therapist does not work', () => {
    const open = openDayIndex([
      { date: '2026-09-01', slots: ['09:00'] },
      { date: '2026-09-02', slots: [] },
    ]);
    const grid = monthGrid(2026, 8, new Date(2026, 7, 29), open);

    expect(grid.find((c) => c.iso === '2026-09-01')?.disabled).toBe(false);
    // Offered-then-rejected is what this replaces: the client used to pick a
    // day, pick a time, submit, and only then find out.
    expect(grid.find((c) => c.iso === '2026-09-02')?.disabled).toBe(true);
  });

  it('leaves future days open while availability is still loading', () => {
    // A fully-closed month that then fills in reads as "nobody is available".
    const grid = monthGrid(2026, 8, new Date(2026, 7, 29), undefined);

    expect(grid.find((c) => c.iso === '2026-09-02')?.disabled).toBe(false);
  });

  it('does not close a day the response never mentioned', () => {
    // Outside the range asked for is not the same as closed.
    const open = openDayIndex([{ date: '2026-09-01', slots: ['09:00'] }]);
    const grid = monthGrid(2026, 8, new Date(2026, 7, 29), open);

    expect(grid.find((c) => c.iso === '2026-09-15')?.disabled).toBe(false);
  });

  it('keeps a past day closed even when the therapist works it', () => {
    const open = openDayIndex([{ date: '2026-08-03', slots: ['09:00'] }]);
    const grid = monthGrid(2026, 7, new Date(2026, 7, 29), open);

    expect(grid.find((c) => c.iso === '2026-08-03')?.disabled).toBe(true);
  });
});

describe('monthGrid when nobody can book the therapist', () => {
  it('closes the whole month at once', () => {
    // Otherwise every day stays tappable and reports "nothing open" one at a
    // time, making the client discover it by exhaustion.
    const grid = monthGrid(2026, 8, new Date(2026, 7, 29), new Map(), true);

    expect(grid.filter((c) => c.iso).every((c) => c.disabled)).toBe(true);
  });

  it('leaves the month open when they are bookable', () => {
    const grid = monthGrid(2026, 8, new Date(2026, 7, 29), new Map(), false);

    expect(grid.find((c) => c.iso === '2026-09-15')?.disabled).toBe(false);
  });
});
