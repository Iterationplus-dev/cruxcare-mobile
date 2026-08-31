import { describe, expect, it } from 'vitest';
import {
  MIN_WINDOW_MINUTES,
  WEEK,
  minutesOfDay,
  rotaSummary,
  timeOptions,
  toWorkingDays,
  windowError,
} from '@/features/therapist/workingHours';
import type { Weekday } from '@/types/care';

describe('WEEK', () => {
  it('reads Monday first, the way the design lays out a week', () => {
    expect(WEEK.map((d) => d.short)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('keeps Sunday as weekday 0, which is what the server stores', () => {
    // Display order and storage order are different things. Renumbering to
    // match the display would silently move every therapist's rota by a day.
    expect(WEEK.find((d) => d.short === 'Sun')?.weekday).toBe(0);
    expect(WEEK.find((d) => d.short === 'Mon')?.weekday).toBe(1);
  });

  it('covers the whole week exactly once', () => {
    expect(new Set(WEEK.map((d) => d.weekday)).size).toBe(7);
  });
});

describe('minutesOfDay', () => {
  it('reads a wall-clock time', () => {
    expect(minutesOfDay('09:30')).toBe(570);
    expect(minutesOfDay('00:00')).toBe(0);
  });

  it('is NaN on something unusable rather than 0', () => {
    // 0 would be midnight — a real time, and a wrong answer.
    expect(minutesOfDay('not-a-time')).toBeNaN();
  });
});

describe('timeOptions', () => {
  it('covers the day in half hours', () => {
    const options = timeOptions();
    expect(options).toHaveLength(48);
    expect(options[0].value).toBe('00:00');
    expect(options.at(-1)?.value).toBe('23:30');
  });

  it('zero-pads, so the values sort and compare as strings', () => {
    expect(timeOptions().map((o) => o.value)).toContain('09:00');
  });
});

describe('windowError', () => {
  it('accepts an ordinary working day', () => {
    expect(windowError('09:00', '17:00')).toBeNull();
  });

  it('refuses a day that closes before it opens', () => {
    // A typo, not a night shift. Saved as-is it yields no bookable times,
    // which reads to the therapist as the rota failing to save.
    expect(windowError('17:00', '09:00')).toBe('Closing time has to be after opening time.');
  });

  it('refuses a day that opens and closes at the same time', () => {
    expect(windowError('09:00', '09:00')).not.toBeNull();
  });

  it(`refuses a window under ${MIN_WINDOW_MINUTES} minutes`, () => {
    expect(windowError('09:00', '09:15')).toContain(String(MIN_WINDOW_MINUTES));
  });

  it('accepts a window of exactly the minimum', () => {
    expect(windowError('09:00', '09:30')).toBeNull();
  });
});

describe('toWorkingDays', () => {
  const row = (weekday: Weekday, enabled: boolean) => ({
    weekday,
    enabled,
    opensAt: '09:00',
    closesAt: '17:00',
  });

  it('sends only the days actually worked', () => {
    const days = toWorkingDays([row(1, true), row(2, false), row(3, true)]);

    expect(days.map((d) => d.weekday)).toEqual([1, 3]);
  });

  it('sorts by the stored weekday, not by display order', () => {
    const days = toWorkingDays([row(0, true), row(1, true)]);

    expect(days.map((d) => d.weekday)).toEqual([0, 1]);
  });

  it('drops the enabled flag, which the server has no column for', () => {
    expect(toWorkingDays([row(1, true)])[0]).toEqual({
      weekday: 1,
      opensAt: '09:00',
      closesAt: '17:00',
    });
  });

  it('is an empty list when nothing is switched on, which clears the rota', () => {
    expect(toWorkingDays([row(1, false)])).toEqual([]);
  });
});

describe('rotaSummary', () => {
  it('names the days and the shared window', () => {
    expect(
      rotaSummary([
        { weekday: 1, opensAt: '09:00', closesAt: '17:00' },
        { weekday: 2, opensAt: '09:00', closesAt: '17:00' },
      ]),
    ).toBe('Mon, Tue · 09:00–17:00');
  });

  it('lists the days Monday-first however they arrive', () => {
    expect(
      rotaSummary([
        { weekday: 0, opensAt: '09:00', closesAt: '17:00' },
        { weekday: 1, opensAt: '09:00', closesAt: '17:00' },
      ]),
    ).toBe('Mon, Sun · 09:00–17:00');
  });

  it('says hours vary rather than picking one day to speak for the rest', () => {
    expect(
      rotaSummary([
        { weekday: 1, opensAt: '09:00', closesAt: '17:00' },
        { weekday: 2, opensAt: '10:00', closesAt: '13:00' },
      ]),
    ).toBe('Mon, Tue · hours vary');
  });

  it('is null with no rota, so the caller can say what empty means', () => {
    // "Not bookable yet" is a real state, not a blank subtitle.
    expect(rotaSummary([])).toBeNull();
  });
});
