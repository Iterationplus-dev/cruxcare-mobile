import type { Appointment, AppointmentStatus } from '@/types/care';

/**
 * TD2's three tabs over the therapist's appointments.
 *
 * Unlike the Clients filters these are a true partition: an appointment is
 * waiting on an answer, agreed, or finished with — never two at once.
 */
export type AppointmentTab = 'requests' | 'confirmed' | 'past';

export const APPOINTMENT_TABS: { value: AppointmentTab; label: string }[] = [
  { value: 'requests', label: 'Requests' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'past', label: 'Past' },
];

/** Statuses that are done with, whatever the outcome was. */
const PAST_STATUSES: AppointmentStatus[] = ['completed', 'cancelled', 'no-show'];

export function tabFor(appointment: Pick<Appointment, 'status'>): AppointmentTab {
  if (appointment.status === 'requested') return 'requests';
  if (appointment.status === 'confirmed') return 'confirmed';
  return 'past';
}

export function inTab(appointment: Pick<Appointment, 'status'>, tab: AppointmentTab): boolean {
  return tabFor(appointment) === tab;
}

export function countForTab(
  appointments: Appointment[] | undefined,
  tab: AppointmentTab,
): number {
  if (!appointments) return 0;
  return appointments.filter((a) => inTab(a, tab)).length;
}

/**
 * Requests are shown soonest-first — the one being decided is the one about to
 * happen. Confirmed reads the same way. Past reads newest-first, because the
 * useful end of a finished list is the recent end.
 */
export function appointmentsInTab(
  appointments: Appointment[] | undefined,
  tab: AppointmentTab,
): Appointment[] {
  if (!appointments) return [];
  const rows = appointments.filter((a) => inTab(a, tab));
  const direction = tab === 'past' ? -1 : 1;
  return rows.sort(
    (a, b) => direction * (new Date(a.slot).getTime() - new Date(b.slot).getTime()),
  );
}

/** Whether a past appointment is worth calling out — a no-show is not the same
 *  as a session that happened, and the list should not read as if it were. */
export function outcomeLabel(appointment: Pick<Appointment, 'status'>): string | null {
  switch (appointment.status) {
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'no-show':
      return 'No-show';
    default:
      return null;
  }
}

export { PAST_STATUSES };
