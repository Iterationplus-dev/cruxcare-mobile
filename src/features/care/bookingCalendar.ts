/**
 * CD3's month grid.
 *
 * Dates are the one thing this screen can know for certain: which days exist,
 * which are in the past, and where they fall in the week. Availability is not
 * known — there is no endpoint for a therapist's open days — so a future day is
 * offered and the server is the one that refuses a slot it cannot honour.
 */
export interface CalendarDay {
  /** `YYYY-MM-DD`, or null for the blanks that pad the first week. */
  iso: string | null;
  day: number | null;
  /** In the past, so not bookable. */
  disabled: boolean;
}

/** Monday-first, matching the design's M T W T F S S header. */
export const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function isoFor(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/**
 * The grid for one month, padded so the first day lands under its weekday.
 * `today` is passed in rather than read, so the calendar can be tested without
 * depending on when the suite runs.
 */
export function monthGrid(year: number, month: number, today: Date): CalendarDay[] {
  const first = new Date(year, month, 1);
  // getDay() is Sunday-first; shift so Monday is 0.
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const cells: CalendarDay[] = [];

  for (let i = 0; i < lead; i += 1) {
    cells.push({ iso: null, day: null, disabled: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      iso: isoFor(year, month, day),
      day,
      disabled: new Date(year, month, day) < startOfToday,
    });
  }

  return cells;
}

/** The times a day is offered in. A fixed working pattern, not availability —
 *  nothing here claims a slot is free, only that it is a time worth asking for. */
export const SLOT_TIMES = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];

export function formatDayHeading(iso: string): string {
  const at = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}
