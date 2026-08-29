import { describe, expect, it } from 'vitest';
import { monthGrid, monthLabel, formatDayHeading, WEEKDAY_LABELS } from '@/features/care/bookingCalendar';

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
