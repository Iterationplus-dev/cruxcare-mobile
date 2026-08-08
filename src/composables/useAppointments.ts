import { useQuery } from '@tanstack/vue-query';
import { appointmentsApi } from '@/api/appointments.api';

export function useAppointments() {
  return useQuery({
    queryKey: ['appointments'],
    queryFn: () => appointmentsApi.list(),
  });
}
