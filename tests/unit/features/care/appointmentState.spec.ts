import { describe, expect, it } from 'vitest';
import {
  canJoin,
  canReschedule,
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

describe('canJoin', () => {
  it('is true for a confirmed session still to come', () => {
    expect(canJoin(appointment({ status: 'confirmed' }), 'upcoming')).toBe(true);
  });

  it('is false for one that has already passed', () => {
    expect(canJoin(appointment({ status: 'confirmed' }), 'overdue')).toBe(false);
  });

  it('is false while it is only requested', () => {
    // Nobody has agreed to meet yet, so there is nothing to join.
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
