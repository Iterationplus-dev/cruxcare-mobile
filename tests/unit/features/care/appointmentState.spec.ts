import { describe, expect, it } from 'vitest';
import {
  canJoin,
  canReschedule,
  isJoinable,
  headlineAppointment,
  howLongAgo,
  nextAppointment,
  overdueAppointment,
  statusBadge,
  timingOf,
} from '@/features/care/appointmentState';
import type { Appointment, AppointmentStatus } from '@/types/care';

const now = new Date('2026-08-31T10:00:00');

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'a-1',
    clientId: 'c-1',
    clientName: 'Leep Pee',
    therapistId: 't-1',
    therapistName: 'Sampo Lamba',
    slot: '2026-09-02T14:00:00',
    type: 'in-person',
    status: 'confirmed',
    reason: null,
    cancellationCutoff: null,
    ...overrides,
  };
}

describe('timingOf', () => {
  it('calls a future open appointment upcoming', () => {
    expect(timingOf(appointment(), now)).toBe('upcoming');
  });

  it('calls a passed open appointment overdue, not upcoming', () => {
    // This is the bug: a confirmed session from two days ago sat under a
    // NEXT SESSION heading with a Join button.
    expect(timingOf(appointment({ slot: '2026-08-29T14:00:00' }), now)).toBe('overdue');
  });

  it('calls a completed appointment past even though it is settled and old', () => {
    expect(
      timingOf(appointment({ slot: '2026-08-29T14:00:00', status: 'completed' }), now),
    ).toBe('past');
  });

  it('does not call a cancelled future appointment upcoming', () => {
    // Settled is settled; the clock does not reopen it.
    expect(timingOf(appointment({ status: 'cancelled' }), now)).toBe('past');
  });

  it('treats an unreadable date as past rather than offering Join on it', () => {
    expect(timingOf(appointment({ slot: 'not-a-date' }), now)).toBe('past');
  });
});

describe('nextAppointment', () => {
  it('picks the soonest, not the first in the list', () => {
    // The server returns newest-first, so taking the first match gave an
    // arbitrary future session rather than the nearest one.
    const far = appointment({ id: 'far', slot: '2026-09-20T09:00:00' });
    const soon = appointment({ id: 'soon', slot: '2026-09-01T09:00:00' });

    expect(nextAppointment([far, soon], now)?.id).toBe('soon');
  });

  it('skips a session whose time has passed', () => {
    const past = appointment({ id: 'past', slot: '2026-08-29T14:00:00' });

    expect(nextAppointment([past], now)).toBeNull();
  });

  it('skips cancelled and completed sessions', () => {
    const rows: Appointment[] = (['cancelled', 'completed', 'no-show'] as AppointmentStatus[]).map(
      (status, i) => appointment({ id: `s-${i}`, status }),
    );

    expect(nextAppointment(rows, now)).toBeNull();
  });

  it('is null before the list loads', () => {
    expect(nextAppointment(undefined, now)).toBeNull();
  });
});

describe('overdueAppointment', () => {
  it('picks the most recent one still open', () => {
    const older = appointment({ id: 'older', slot: '2026-08-20T14:00:00' });
    const recent = appointment({ id: 'recent', slot: '2026-08-29T14:00:00' });

    expect(overdueAppointment([older, recent], now)?.id).toBe('recent');
  });

  it('ignores one that was already settled', () => {
    const done = appointment({ slot: '2026-08-29T14:00:00', status: 'completed' });

    expect(overdueAppointment([done], now)).toBeNull();
  });
});

describe('headlineAppointment', () => {
  it('prefers an upcoming session over a missed one', () => {
    // Someone with a session tomorrow does not need last week's no-show at the
    // top of their home screen.
    const missed = appointment({ id: 'missed', slot: '2026-08-29T14:00:00' });
    const soon = appointment({ id: 'soon', slot: '2026-09-01T09:00:00' });

    expect(headlineAppointment([missed, soon], now)).toEqual({
      appointment: soon,
      timing: 'upcoming',
    });
  });

  it('surfaces the missed one when nothing is booked', () => {
    const missed = appointment({ id: 'missed', slot: '2026-08-29T14:00:00' });

    expect(headlineAppointment([missed], now)?.timing).toBe('overdue');
  });

  it('is null when there is nothing to say', () => {
    expect(headlineAppointment([], now)).toBeNull();
  });
});

describe('statusBadge', () => {
  it('says missed for an overdue session', () => {
    expect(statusBadge(appointment(), 'overdue')).toEqual({ label: 'MISSED', tone: 'warning' });
  });

  it('does not call a merely requested session confirmed', () => {
    // Home printed CONFIRMED on every session it showed, including ones the
    // therapist had never confirmed.
    expect(statusBadge(appointment({ status: 'requested' }), 'upcoming')).toEqual({
      label: 'AWAITING CONFIRMATION',
      tone: 'warning',
    });
  });

  it('says confirmed only when it is', () => {
    expect(statusBadge(appointment({ status: 'confirmed' }), 'upcoming').label).toBe('CONFIRMED');
  });

  it('renders an unknown server status neutrally rather than breaking', () => {
    expect(statusBadge(appointment({ status: 'rescheduling' as AppointmentStatus }), 'upcoming')).toEqual(
      { label: 'RESCHEDULING', tone: 'default' },
    );
  });
});

describe('isJoinable', () => {
  const at = '2026-08-31T10:00:00';

  it('opens shortly before the hour, so nobody is refused at 13:59', () => {
    const justBefore = new Date('2026-08-31T09:55:00');
    expect(isJoinable(appointment({ slot: at }), justBefore)).toBe(true);
  });

  it('is still open once the session has started', () => {
    // The bug this replaces: Join vanished the instant the clock passed the
    // slot, which is exactly when someone would reach for it.
    const justAfter = new Date('2026-08-31T10:05:00');
    expect(isJoinable(appointment({ slot: at }), justAfter)).toBe(true);
  });

  it('closes once the window has run out', () => {
    const longAfter = new Date('2026-08-31T11:30:00');
    expect(isJoinable(appointment({ slot: at }), longAfter)).toBe(false);
  });

  it('is shut well before the time', () => {
    const hoursEarly = new Date('2026-08-31T07:00:00');
    expect(isJoinable(appointment({ slot: at }), hoursEarly)).toBe(false);
  });

  it('is false while it is only requested', () => {
    // Nobody has agreed to meet yet, so there is no room to enter.
    expect(isJoinable(appointment({ slot: at, status: 'requested' }), new Date(at))).toBe(false);
  });

  it('is false for a cancelled session inside its window', () => {
    expect(isJoinable(appointment({ slot: at, status: 'cancelled' }), new Date(at))).toBe(false);
  });

  it('is false on an unusable date rather than throwing', () => {
    expect(isJoinable(appointment({ slot: 'not-a-date' }), now)).toBe(false);
  });
});

describe('canJoin', () => {
  it('agrees with isJoinable, so both sides of a call use one rule', () => {
    // A therapist must never be in a room the client is locked out of.
    const soon = appointment({ slot: '2026-08-31T10:00:00' });
    const during = new Date('2026-08-31T10:05:00');

    expect(isJoinable(soon, during)).toBe(true);
  });

  it('is false while it is only requested', () => {
    expect(canJoin(appointment({ status: 'requested' }), 'upcoming')).toBe(false);
  });
});

describe('canReschedule', () => {
  it('allows moving a missed session, which is the main reason anyone does', () => {
    expect(canReschedule(appointment({ status: 'confirmed' }))).toBe(true);
  });

  it('refuses a settled one, mirroring the server', () => {
    expect(canReschedule(appointment({ status: 'completed' }))).toBe(false);
    expect(canReschedule(appointment({ status: 'cancelled' }))).toBe(false);
  });
});

describe('howLongAgo', () => {
  it('counts days', () => {
    expect(howLongAgo('2026-08-29T10:00:00', now)).toBe('2 days ago');
  });

  it('says yesterday rather than 1 days ago', () => {
    expect(howLongAgo('2026-08-30T10:00:00', now)).toBe('yesterday');
  });

  it('counts hours within a day', () => {
    expect(howLongAgo('2026-08-31T07:00:00', now)).toBe('3 hours ago');
  });

  it('is null for something still ahead', () => {
    expect(howLongAgo('2026-09-01T10:00:00', now)).toBeNull();
  });

  it('is null rather than a wrong number on an unusable date', () => {
    expect(howLongAgo('not-a-date', now)).toBeNull();
  });
});


describe('a session the therapist has started', () => {
  const started = appointment({ slot: '2026-08-31T10:00:00', status: 'active' });

  it('is joinable however long it has been running', () => {
    // This is what "until the therapist ends the session" means. No clock is
    // consulted — the server moves it off `active` when they end it, or the
    // hourly sweep closes an abandoned one.
    const hoursLater = new Date('2026-08-31T14:00:00');
    expect(isJoinable(started, hoursLater)).toBe(true);
  });

  it('is joinable before its own slot too', () => {
    const early = new Date('2026-08-31T09:00:00');
    expect(isJoinable(started, early)).toBe(true);
  });

  it('counts as happening rather than late', () => {
    const wellAfter = new Date('2026-08-31T13:00:00');
    expect(timingOf(started, wellAfter)).toBe('upcoming');
  });

  it('is the one status worth shouting about', () => {
    expect(statusBadge(started, 'upcoming')).toEqual({ label: 'IN PROGRESS', tone: 'success' });
  });

  it('can still be rescheduled — it is not settled', () => {
    expect(canReschedule(started)).toBe(true);
  });
});
