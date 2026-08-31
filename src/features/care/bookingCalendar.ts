/**
 * CD3's month grid.
 *
 * The grid used to offer every future day and leave the server to refuse what
 * it could not honour, because there was no endpoint for a therapist's open
 * days. There is now: `GET /therapists/{id}/availability` returns the days a
 * therapist actually set. A day the therapist does not work is closed here
 * rather than offered and rejected after someone has planned around it.
 */
export interface CalendarDay {
  /** `YYYY-MM-DD`, or null for the blanks that pad the first week. */
  iso: string | null;
  day: number | null;
  /** In the past, or not a day this therapist works — either way not bookable. */
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
 *
 * `openDays` is the therapist's availability for the range. Passing `undefined`
 * — the state while it is still loading — leaves future days enabled rather
 * than flashing a fully-closed month that then fills in.
 *
 * `noneBookable` closes the whole month at once, for a therapist the server
 * says nobody can book. Without it every day stays tappable and reports
 * "nothing open" one at a time, making the client discover it by exhaustion.
 */
export function monthGrid(
  year: number,
  month: number,
  today: Date,
  openDays?: Map<string, string[]>,
  noneBookable = false,
): CalendarDay[] {
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
    const iso = isoFor(year, month, day);
    const past = new Date(year, month, day) < startOfToday;
    // A date the response does not mention is outside the range asked for, not
    // a closed day — so it stays open rather than being greyed out on the
    // strength of a question nobody asked.
    const slots = openDays?.get(iso);

    cells.push({
      iso,
      day,
      disabled:
        past || noneBookable || (openDays !== undefined && slots !== undefined && slots.length === 0),
    });
  }

  return cells;
}

/**
 * The times open on one date, from the therapist's own hours minus what is
 * already booked.
 *
 * Empty means nothing is free that day, which the screen says rather than
 * falling back to a default list — a fixed pattern of times was exactly the
 * invented availability this replaced.
 */
export function slotsFor(iso: string | null, openDays: Map<string, string[]> | undefined): string[] {
  if (!iso || !openDays) return [];
  return openDays.get(iso) ?? [];
}

/** Availability rows keyed by date, for the lookups above. */
export function openDayIndex(
  days: { date: string; slots: string[] }[] | undefined,
): Map<string, string[]> | undefined {
  if (!days) return undefined;
  return new Map(days.map((day) => [day.date, day.slots]));
}

export function formatDayHeading(iso: string): string {
  const at = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}
