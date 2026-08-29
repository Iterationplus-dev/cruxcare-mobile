<template>
  <ion-page>
    <AppHeader title="Appointments" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['appointments']]" />
      <LoadingState v-if="isPending" label="Loading appointments…" />
      <template v-else>
        <!-- TD2's three tabs. A true partition, unlike the Clients filters:
             an appointment is waiting, agreed, or finished with. -->
        <div class="cc-appt__tabs" role="tablist" aria-label="Filter appointments">
          <button
            v-for="t in APPOINTMENT_TABS"
            :key="t.value"
            type="button"
            role="tab"
            class="cc-appt__tab"
            :class="{ 'cc-appt__tab--on': tab === t.value }"
            :aria-selected="tab === t.value"
            @click="tab = t.value"
          >
            {{ t.label }} {{ countForTab(all, t.value) }}
          </button>
        </div>

        <EmptyState
          v-if="!visible.length"
          icon="event_available"
          :title="emptyTitle"
          :message="emptyMessage"
        />

        <div v-else class="cc-screen__pad">
          <AppCard v-for="a in visible" :key="a.id" class="cc-req">
            <div class="cc-req__head">
              <AppAvatar :name="a.clientName" :size="40" />
              <div class="cc-req__body">
                <div class="cc-text-body-strong" style="font-size: 14.5px">{{ a.clientName }}</div>
                <div class="cc-text-caption">{{ formatSlot(a.slot) }} · {{ a.type }}</div>
              </div>
              <AppBadge
                v-if="outcomeLabel(a)"
                :label="outcomeLabel(a) ?? ''"
                :tone="a.status === 'no-show' ? 'warning' : a.status === 'completed' ? 'success' : 'default'"
              />
            </div>

            <!-- TD2 labels the reason rather than dropping it in as loose text:
                 it is what the decision is made on. -->
            <div v-if="a.reason" class="cc-req__reason">
              <span class="cc-req__reason-label">Reason given</span>
              <p class="cc-text-body" style="font-size: 13px; margin: 0">{{ a.reason }}</p>
            </div>

            <template v-if="a.status === 'requested'">
              <div class="cc-req__actions">
                <AppButton :loading="pendingId === a.id" @click="respond(a.id, 'confirmed')">
                  Accept
                </AppButton>
                <AppButton
                  variant="secondary"
                  :loading="pendingId === a.id"
                  @click="respond(a.id, 'cancelled')"
                >
                  Decline
                </AppButton>
              </div>
              <p class="cc-text-caption cc-req__note">
                Declining frees the slot so the client can book another time.
              </p>
            </template>
          </AppCard>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import {
  AppAvatar,
  AppBadge,
  AppButton,
  AppCard,
  AppHeader,
  AppPullToRefresh,
} from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { appointmentsApi } from '@/api/appointments.api';
import { useAppointments } from '@/composables/useAppointments';
import { useToast } from '@/composables/useToast';
import {
  APPOINTMENT_TABS,
  appointmentsInTab,
  countForTab,
  outcomeLabel,
  type AppointmentTab,
} from '@/features/therapist/appointmentTabs';
import { ApiError } from '@/types/api';
import type { AppointmentStatus } from '@/types/care';

/** TD2 · Appointment management — the reason is visible before deciding. */
const { data, isPending, refetch } = useAppointments();
const toast = useToast();

const all = computed(() => data.value?.data);
const tab = ref<AppointmentTab>('requests');
const visible = computed(() => appointmentsInTab(all.value, tab.value));
const pendingId = ref('');

const emptyTitle = computed(() => {
  if (tab.value === 'requests') return 'No requests waiting';
  if (tab.value === 'confirmed') return 'Nothing confirmed';
  return 'Nothing past yet';
});
const emptyMessage = computed(() => {
  if (tab.value === 'requests') return 'New booking requests will appear here first.';
  if (tab.value === 'confirmed') return 'Appointments you have accepted will appear here.';
  return 'Sessions that have happened, or were cancelled, will appear here.';
});

function formatSlot(iso: string) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  // en-GB to match the design's "Tue 19 Aug · 09:00" — day before month, 24-hour.
  return at.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

async function respond(id: string, status: AppointmentStatus) {
  pendingId.value = id;
  try {
    await appointmentsApi.updateStatus(id, status);
    await refetch();
    await toast.show(status === 'confirmed' ? 'Appointment accepted' : 'Appointment declined', 'success');
  } catch (error) {
    // The slot may have gone, or the client withdrawn, while this sat open.
    const message =
      error instanceof ApiError
        ? error.message
        : 'We could not update that appointment. Please try again.';
    await toast.show(message, 'danger', { title: 'Not updated' });
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
.cc-appt__tabs {
  display: flex;
  gap: 8px;
  padding: 12px 16px 0;
  overflow-x: auto;
}
.cc-appt__tab {
  flex: none;
  padding: 8px 14px;
  border-radius: var(--cc-radius-pill);
  border: 1px solid var(--cc-line);
  background: var(--cc-surface-0);
  font-family: var(--cc-font-interface);
  font-size: 13px;
  font-weight: 600;
  color: var(--cc-ink-600);
  cursor: pointer;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.cc-appt__tab--on {
  background: var(--cc-color-primary);
  border-color: var(--cc-color-primary);
  color: #fff;
}
.cc-req__head {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}
.cc-req__body {
  flex: 1;
  min-width: 0;
}
.cc-req__reason {
  background: var(--cc-color-mist);
  border-radius: var(--cc-radius-md);
  padding: 11px 13px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.cc-req__reason-label {
  font-family: var(--cc-font-interface);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--cc-ink-500);
}
.cc-req__actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}
.cc-req__note {
  margin-top: 8px;
}
</style>
