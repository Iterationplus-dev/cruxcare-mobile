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

  async updateStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    const { data } = await apiClient.patch<Appointment>(`/appointments/${id}`, { status });
    return data;
  },
};
