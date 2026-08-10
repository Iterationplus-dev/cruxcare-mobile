<template>
  <ion-page>
    <AppHeader title="Appointments" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <LoadingState v-if="isPending" label="Loading requests…" />
      <EmptyState v-else-if="!requests.length" icon="event_available" title="No requests waiting" message="New booking requests will appear here first." />
      <div v-else class="cc-screen__pad">
        <AppCard v-for="a in requests" :key="a.id" class="cc-req">
          <div class="cc-req__head">
            <AppAvatar :name="a.clientName" :size="40" />
            <div class="cc-req__body">
              <div class="cc-text-body-strong" style="font-size: 14.5px">{{ a.clientName }}</div>
              <div class="cc-text-caption">{{ formatSlot(a.slot) }} · {{ a.type }}</div>
            </div>
          </div>
          <p v-if="a.reason" class="cc-text-body" style="font-size: 12.5px">{{ a.reason }}</p>
          <div class="cc-req__actions">
            <AppButton :loading="pendingId === a.id" @click="respond(a.id, 'confirmed')">Accept</AppButton>
            <AppButton variant="secondary" :loading="pendingId === a.id" @click="respond(a.id, 'cancelled')">Decline</AppButton>
          </div>
          <p class="cc-text-caption" style="margin-top: 8px">Declining notifies the client immediately so they can rebook.</p>
        </AppCard>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { AppAvatar, AppButton, AppCard, AppHeader } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { appointmentsApi } from '@/api/appointments.api';
import { useAppointments } from '@/composables/useAppointments';
import { useToast } from '@/composables/useToast';
import type { AppointmentStatus } from '@/types/care';

/** TD2 · Appointment management — request reason visible before accepting. */
const { data, isPending, refetch } = useAppointments();
const requests = computed(() => data.value?.data.filter((a) => a.status === 'requested') ?? []);
const pendingId = ref('');
const toast = useToast();

function formatSlot(iso: string) {
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function respond(id: string, status: AppointmentStatus) {
  pendingId.value = id;
  try {
    await appointmentsApi.updateStatus(id, status);
    await refetch();
    await toast.show(status === 'confirmed' ? 'Appointment accepted' : 'Appointment declined', 'success');
  } finally {
    pendingId.value = '';
  }
}
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cc-req__head {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}
.cc-req__body {
  flex: 1;
}
.cc-req__actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
</style>
