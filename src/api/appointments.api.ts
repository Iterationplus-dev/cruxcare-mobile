import { apiClient } from './client';
import type { CursorPage } from '@/types/api';
import type { Appointment, AppointmentStatus, AppointmentType } from '@/types/care';

export interface CreateAppointmentPayload {
  therapistId: string;
  slot: string;
  type: AppointmentType;
}

export const appointmentsApi = {
  async list(cursor?: string): Promise<CursorPage<Appointment>> {
    const { data } = await apiClient.get<CursorPage<Appointment>>('/appointments', {
      params: { cursor },
    });
    return data;
  },

  async create(payload: CreateAppointmentPayload): Promise<Appointment> {
    const { data } = await apiClient.post<Appointment>('/appointments', payload);
    return data;
  },

  /**
   * Move an existing appointment to a new time.
   *
   * A move, not a cancel-and-rebook: the same appointment comes back with a new
   * slot, so a client who moved one session has one session rather than a
   * cancelled one and a new one to reconcile. The server sends it back to
   * `requested` — the therapist agreed to a time, not to whichever time it is
   * moved to.
   */
  async reschedule(id: string, slot: string, type?: AppointmentType): Promise<Appointment> {
    const { data } = await apiClient.post<Appointment>(`/appointments/${id}/reschedule`, {
      slot,
      ...(type ? { type } : {}),
    });
    return data;
  },

  /**
   * The therapist starts the session. Allowed from fifteen minutes before the
   * slot until the abandonment cutoff; outside that the server answers
   * `outside_session_window`, because a session started days early is not a
   * session, it is a client seeing "in progress" on a Tuesday.
   *
   * Starting twice has the same outcome as starting once.
   */
  async start(id: string): Promise<Appointment> {
    const { data } = await apiClient.post<Appointment>(`/appointments/${id}/start`);
    return data;
  },

  /** Ends it. The client's Join disappears because the status moves, not
   *  because a timer ran out. */
  async end(id: string): Promise<Appointment> {
    const { data } = await apiClient.post<Appointment>(`/appointments/${id}/end`);
    return data;
  },

  async updateStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    const { data } = await apiClient.patch<Appointment>(`/appointments/${id}`, { status });
    return data;
  },
};
