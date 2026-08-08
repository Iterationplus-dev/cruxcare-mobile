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

  async updateStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    const { data } = await apiClient.patch<Appointment>(`/appointments/${id}`, { status });
    return data;
  },
};
