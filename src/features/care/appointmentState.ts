import type { Appointment } from '@/types/care';

/**
 * Where an appointment sits relative to now.
 *
 * Home and the Care hub both picked "the next session" with a plain
 * `find(a => a.status === 'confirmed')`, which has no notion of time in it at
 * all. A session from last Sunday sat under a NEXT SESSION heading with a
 * CONFIRMED badge and a Join button, days after it had been and gone.
 *
 * `overdue` is the case that mattered: still open, but its time has passed. It
 * is not the same as `past` — a completed session is behind you and settled,
 * an overdue one is behind you and unresolved, and only the second is asking
 * something of the person looking at it.
 */
export type AppointmentTiming = 'upcoming' | 'overdue' | 'past';

/** AppBadge's own vocabulary, so a badge cannot be given a tone it has no
 *  styling for. */
type BadgeTone = 'success' | 'danger' | 'warning' | 'default';

/** Statuses that are finished with, whatever the clock says. */
const SETTLED = ['completed', 'cancelled', 'no-show'];

export function isSettled(appointment: Appointment): boolean {
  return SETTLED.includes(appointment.status);
}

export function timingOf(appointment: Appointment, now: Date = new Date()): AppointmentTiming {
  const at = new Date(appointment.slot);
  // An unreadable date is treated as past rather than upcoming: offering Join
  // on something we cannot place in time is the worse of the two mistakes.
  if (Number.isNaN(at.getTime())) return 'past';

  if (at.getTime() > now.getTime()) return isSettled(appointment) ? 'past' : 'upcoming';

  return isSettled(appointment) ? 'past' : 'overdue';
}

/** Soonest first, so "next" means next. */
function bySlotAscending(a: Appointment, b: Appointment): number {
  return new Date(a.slot).getTime() - new Date(b.slot).getTime();
}

/**
 * The genuinely next session: still to happen, not settled, soonest first.
 *
 * Order is not assumed. The list arrives newest-first from the server, so
 * taking the first match returned an arbitrary future session rather than the
 * nearest one.
 */
export function nextAppointment(
  appointments: Appointment[] | undefined,
  now: Date = new Date(),
): Appointment | null {
  if (!appointments) return null;

  return (
    [...appointments]
      .filter((a) => timingOf(a, now) === 'upcoming')
      .sort(bySlotAscending)[0] ?? null
  );
}

/**
 * The most recent appointment whose time has passed while still open.
 *
 * Surfaced only when there is nothing upcoming: someone with a session
 * tomorrow does not need last week's no-show at the top of their home screen,
 * but someone with nothing booked and a missed session does.
 */
export function overdueAppointment(
  appointments: Appointment[] | undefined,
  now: Date = new Date(),
): Appointment | null {
  if (!appointments) return null;

  return (
    [...appointments]
      .filter((a) => timingOf(a, now) === 'overdue')
      .sort(bySlotAscending)
      .at(-1) ?? null
  );
}

/**
 * What to show at the top: the next session if there is one, otherwise a
 * missed one still waiting to be dealt with.
 */
export function headlineAppointment(
  appointments: Appointment[] | undefined,
  now: Date = new Date(),
): { appointment: Appointment; timing: AppointmentTiming } | null {
  const upcoming = nextAppointment(appointments, now);
  if (upcoming) return { appointment: upcoming, timing: 'upcoming' };

  const overdue = overdueAppointment(appointments, now);
  return overdue ? { appointment: overdue, timing: 'overdue' } : null;
}

/**
 * The badge for an appointment, from its real status rather than a hardcoded
 * word. Home printed CONFIRMED on every session it showed, including ones the
 * therapist had never confirmed.
 */
export function statusBadge(
  appointment: Appointment,
  timing: AppointmentTiming,
): { label: string; tone: BadgeTone } {
  if (timing === 'overdue') return { label: 'MISSED', tone: 'warning' };

  switch (appointment.status) {
    case 'confirmed':
      return { label: 'CONFIRMED', tone: 'success' };
    case 'requested':
      return { label: 'AWAITING CONFIRMATION', tone: 'warning' };
    case 'completed':
      return { label: 'COMPLETED', tone: 'default' };
    case 'cancelled':
      return { label: 'CANCELLED', tone: 'default' };
    case 'no-show':
      return { label: 'MISSED', tone: 'warning' };
    default:
      // A status this build has never heard of still renders, neutrally,
      // rather than leaving the badge blank or throwing.
      return { label: String(appointment.status).toUpperCase(), tone: 'default' };
  }
}

/** Joining is only meaningful for a confirmed session that has not passed. */
export function canJoin(appointment: Appointment, timing: AppointmentTiming): boolean {
  return timing === 'upcoming' && appointment.status === 'confirmed';
}

/** A settled appointment is history; moving one would rewrite what happened
 *  rather than change what is going to. Mirrors the server's own rule. */
export function canReschedule(appointment: Appointment): boolean {
  return !isSettled(appointment);
}

/** "3 days ago", for saying how overdue something is without a date library. */
export function howLongAgo(iso: string, now: Date = new Date()): string | null {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;

  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 0) return null;
  if (minutes < 60) return minutes <= 1 ? 'just now' : `${minutes} minutes ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? 'an hour ago' : `${hours} hours ago`;

  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}
