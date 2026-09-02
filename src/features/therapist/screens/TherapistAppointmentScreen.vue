<template>
  <ion-page>
    <AppHeader title="Session" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <LoadingState v-if="isPending" label="Loading this session…" />

        <EmptyState
          v-else-if="!appointment"
          icon="event_busy"
          title="This session isn't available"
          message="It may have been cancelled, or it belongs to another therapist."
        />

        <template v-else>
          <AppCard class="cc-session__head">
            <AppAvatar :name="appointment.clientName" :size="48" />
            <div class="cc-session__who">
              <div class="cc-text-body-strong" style="font-size: 16px">
                {{ appointment.clientName }}
              </div>
              <div class="cc-text-caption">{{ formatSlot(appointment.slot) }}</div>
              <div class="cc-text-caption">{{ appointment.type }} session</div>
            </div>
            <AppBadge :label="badge.label" :tone="badge.tone" />
          </AppCard>

          <p v-if="lateBy" class="cc-session__late">This time has passed · {{ lateBy }}</p>

          <div v-if="appointment.reason" class="cc-session__reason">
            <span class="cc-session__reason-label">Reason given</span>
            <p>{{ appointment.reason }}</p>
          </div>

          <!-- A requested session is a decision before it is a session. -->
          <template v-if="appointment.status === 'requested'">
            <div class="cc-session__pair">
              <AppButton :loading="busy" @click="setStatus('confirmed')">Accept</AppButton>
              <AppButton variant="secondary" :loading="busy" @click="setStatus('cancelled')">
                Decline
              </AppButton>
            </div>
            <p class="cc-text-caption">Declining frees the slot so the client can book another time.</p>
          </template>

          <template v-else-if="appointment.status === 'confirmed'">
            <AppButton v-if="canStart" icon="videocam" @click="startSession">
              Start the session
            </AppButton>
            <p v-if="canStart" class="cc-text-caption">
              Your client joins from their own app around the appointed time.
            </p>
            <p v-else class="cc-text-caption">
              The room opens {{ JOIN_OPENS_MINUTES }} minutes before the appointed time.
            </p>

            <AppSectionLabel label="When it is over" />
            <div class="cc-session__pair">
              <AppButton variant="secondary" :loading="busy" @click="setStatus('completed')">
                Mark completed
              </AppButton>
              <AppButton variant="secondary" :loading="busy" @click="setStatus('no-show')">
                Mark no-show
              </AppButton>
            </div>
          </template>

          <AppCard style="padding: 0">
            <AppListRow
              title="Message this client"
              subtitle="Talk before or after the session"
              icon="chat"
              chevron
              clickable
              :divider="false"
              @click="openChat"
            />
          </AppCard>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import {
  AppAvatar,
  AppBadge,
  AppButton,
  AppCard,
  AppHeader,
  AppListRow,
  AppSectionLabel,
} from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { useAppointments } from '@/composables/useAppointments';
import { findThreadWith, useChatThreads } from '@/composables/useChat';
import { appointmentsApi } from '@/api/appointments.api';
import { useToast } from '@/composables/useToast';
import {
  JOIN_OPENS_MINUTES,
  howLongAgo,
  isJoinable,
  statusBadge,
  timingOf,
} from '@/features/care/appointmentState';
import { ApiError } from '@/types/api';
import type { AppointmentStatus } from '@/types/care';

/**
 * One session, from the therapist's side.
 *
 * Today's schedule used to push straight to the appointments list with no id,
 * so tapping a named client at a named time landed on an undifferentiated
 * calendar. This is where that tap belongs — and it is the only place a
 * therapist can start a session from, which previously had no entry point on
 * their side of the app at all.
 */
const route = useRoute();
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();

const id = computed(() => String(route.params.id ?? ''));
const { data: page, isPending } = useAppointments();
const appointment = computed(() => page.value?.data.find((a) => a.id === id.value) ?? null);

const timing = computed(() =>
  appointment.value ? timingOf(appointment.value) : ('past' as const),
);
const badge = computed(() =>
  appointment.value
    ? statusBadge(appointment.value, timing.value)
    : { label: '', tone: 'default' as const },
);
const lateBy = computed(() =>
  appointment.value && timing.value === 'overdue' ? howLongAgo(appointment.value.slot) : null,
);

/** The same window the client's Join uses, so neither side is waiting for a
 *  room the other cannot enter yet. */
const canStart = computed(() => !!appointment.value && isJoinable(appointment.value));

const busy = ref(false);

function formatSlot(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function startSession() {
  if (!appointment.value) return;
  router.push({ name: 'video-visit', params: { id: appointment.value.id } });
}

const { data: threads } = useChatThreads();

function openChat() {
  const thread = findThreadWith(threads.value, appointment.value?.clientId);
  if (thread) router.push({ name: 'chat-thread', params: { id: thread.id } });
  else router.push({ name: 'chat-inbox' });
}

async function setStatus(status: AppointmentStatus) {
  if (!appointment.value) return;

  busy.value = true;
  try {
    await appointmentsApi.updateStatus(appointment.value.id, status);
    await queryClient.invalidateQueries({ queryKey: ['appointments'] });
    await toast.show(
      status === 'confirmed'
        ? 'Session confirmed. Your client has been told.'
        : `Session marked ${status.replace('-', ' ')}.`,
      status === 'no-show' ? 'warning' : 'success',
    );
  } catch (error) {
    // The server decides which transitions are legal, and its reason is more
    // specific than anything phrased here.
    const message =
      error instanceof ApiError
        ? error.message
        : 'We could not update this session. Please try again.';
    await toast.show(message, 'danger', { title: 'Not updated' });
  } finally {
    busy.value = false;
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
.cc-session__head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cc-session__who {
  flex: 1;
  min-width: 0;
}
.cc-session__late {
  margin: -4px 0 0;
  font-size: 12.5px;
  color: var(--cc-color-warning-text);
}
.cc-session__reason {
  padding: 12px 14px;
  border-radius: var(--cc-radius-lg);
  background: var(--cc-color-mist);
}
.cc-session__reason-label {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--cc-ink-600);
}
.cc-session__reason p {
  margin: 4px 0 0;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--cc-ink-900);
}
.cc-session__pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
</style>
