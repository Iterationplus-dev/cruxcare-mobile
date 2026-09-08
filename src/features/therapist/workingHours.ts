import type { Weekday, WorkingDay } from '@/types/care';

/**
 * The therapist's rota — which days they work and between what hours.
 *
 * Until the server grew `therapist_availability`, both the directory's next
 * slot and the client booking calendar applied one default window to everybody,
 * so the app offered clients a Tuesday morning with a therapist who never works
 * Tuesdays. Everything here edits the real record instead.
 *
 * The week reads Monday-first because that is how the booking calendar and the
 * design lay a week out, while `weekday` stays Sunday-0 to match both the
 * server's storage and `Date.getDay()`. The two orderings are kept apart
 * deliberately: display order is a design decision, storage order is a
 * contract.
 */

export interface WeekdayOption {
  weekday: Weekday;
  label: string;
  short: string;
}

/** Monday first for display; `weekday` is still the stored Sunday-0 index. */
export const WEEK: WeekdayOption[] = [
  { weekday: 1, label: 'Monday', short: 'Mon' },
  { weekday: 2, label: 'Tuesday', short: 'Tue' },
  { weekday: 3, label: 'Wednesday', short: 'Wed' },
  { weekday: 4, label: 'Thursday', short: 'Thu' },
  { weekday: 5, label: 'Friday', short: 'Fri' },
  { weekday: 6, label: 'Saturday', short: 'Sat' },
  { weekday: 0, label: 'Sunday', short: 'Sun' },
];

/**
 * What a day is pre-filled with when a therapist first switches it on.
 *
 * A starting point they can see and change, not an assumption made on their
 * behalf: nothing is stored until they save, and a day they never switch on is
 * never sent.
 */
export const DEFAULT_OPENS = '09:00';
export const DEFAULT_CLOSES = '17:00';

/** The server's rule, mirrored so the screen can refuse before the round trip
 *  rather than surfacing a 422 for something we could see was wrong. */
export const MIN_WINDOW_MINUTES = 30;

/** "09:00" → 540. */
export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.NaN;
  return hours * 60 + minutes;
}

/** Every half hour of the day, for the opens/closes pickers. */
export function timeOptions(stepMinutes = 30): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];

  for (let minute = 0; minute < 24 * 60; minute += stepMinutes) {
    const value = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
    options.push({ value, label: value });
  }

  return options;
}

/** Why this day cannot be saved, or null when it is fine. */
export function windowError(opensAt: string, closesAt: string): string | null {
  const opens = minutesOfDay(opensAt);
  const closes = minutesOfDay(closesAt);

  if (!Number.isFinite(opens) || !Number.isFinite(closes)) return 'Pick an opening and closing time.';
  // Closing before opening is a typo, not a night shift. Stored as-is it would
  // silently produce no bookable times, which reads as the rota not saving.
  if (closes <= opens) return 'Closing time has to be after opening time.';
  if (closes - opens < MIN_WINDOW_MINUTES) return `A working day needs at least ${MIN_WINDOW_MINUTES} minutes.`;

  return null;
}

/** The rota in the order the server stores it, only the days actually worked. */
export function toWorkingDays(
  rows: { weekday: Weekday; enabled: boolean; opensAt: string; closesAt: string }[],
): WorkingDay[] {
  return rows
    .filter((row) => row.enabled)
    .map(({ weekday, opensAt, closesAt }) => ({ weekday, opensAt, closesAt }))
    .sort((a, b) => a.weekday - b.weekday);
}

/**
 * A one-line summary of the rota for a row subtitle.
 *
 * Null when nothing is set — the caller says "not bookable yet" rather than
 * this inventing a phrase for the empty case, which is a state with a real
 * meaning rather than a blank.
 */
export function rotaSummary(days: WorkingDay[]): string | null {
  if (days.length === 0) return null;

  const named = WEEK.filter((day) => days.some((d) => d.weekday === day.weekday)).map((d) => d.short);

  // One window shared by every working day is by far the common case, and
  // naming it is more useful than repeating it per day.
  const hours = days.map((d) => `${d.opensAt}–${d.closesAt}`);
  const uniform = hours.every((h) => h === hours[0]);

  return uniform ? `${named.join(', ')} · ${hours[0]}` : `${named.join(', ')} · hours vary`;
}
