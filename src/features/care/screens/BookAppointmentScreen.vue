<template>
  <ion-page>
    <AppHeader title="Book a visit" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <AppCard v-if="therapist" class="cc-book__therapist">
          <AppAvatar :name="therapist.name" :src="therapist.avatarUrl ?? undefined" :size="44" />
          <div>
            <div class="cc-text-body-strong" style="font-size: 14.5px">{{ therapist.name }}</div>
            <div class="cc-text-caption">{{ therapist.specialties.join(', ') }}</div>
          </div>
        </AppCard>

        <div class="cc-book__daystrip">
          <button
            v-for="d in days"
            :key="d.iso"
            type="button"
            class="cc-book__day"
            :class="{ 'cc-book__day--selected': d.iso === selectedDay }"
            @click="selectedDay = d.iso"
          >
            <div class="cc-book__day-label">{{ d.label }}</div>
            <div class="cc-book__day-num">{{ d.num }}</div>
          </button>
        </div>

        <div class="cc-text-body-strong" style="font-size: 16px">{{ selectedDayFull }}</div>
        <div class="cc-book__slots">
          <button
            v-for="s in slots"
            :key="s.time"
            type="button"
            class="cc-book__slot"
            :class="{ 'cc-book__slot--selected': s.time === selectedSlot, 'cc-book__slot--taken': s.taken }"
            :disabled="s.taken"
            @click="selectedSlot = s.time"
          >
            {{ s.time }}
          </button>
        </div>

        <div class="cc-text-body-strong" style="font-size: 16px">Visit type</div>
        <div class="cc-book__types">
          <button
            type="button"
            class="cc-book__type"
            :class="{ 'cc-book__type--selected': type === 'video' }"
            @click="type = 'video'"
          >
            <AppIcon name="videocam" :size="22" color="var(--cc-color-primary)" />
            <div class="cc-text-body-strong" style="font-size: 14.5px">Video</div>
          </button>
          <button
            type="button"
            class="cc-book__type"
            :class="{ 'cc-book__type--selected': type === 'in-person' }"
            @click="type = 'in-person'"
          >
            <AppIcon name="store" :size="22" color="var(--cc-ink-600)" />
            <div class="cc-text-body-strong" style="font-size: 14.5px">In person</div>
          </button>
        </div>
      </div>

      <div class="cc-screen__footer">
        <div class="cc-book__summary">
          <span class="cc-text-caption">{{ selectedDayFull }} · {{ selectedSlot }} · {{ type }}</span>
        </div>
        <AppButton :disabled="!selectedSlot" :loading="submitting" @click="onSubmit">Request this slot</AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppAvatar, AppButton, AppCard, AppHeader, AppIcon } from '@/components/ui';
import { appointmentsApi } from '@/api/appointments.api';
import { ApiError } from '@/types/api';
import { useTherapist } from '@/composables/useTherapists';
import { useToast } from '@/composables/useToast';
import type { AppointmentType } from '@/types/care';

const route = useRoute();
const router = useRouter();
const toast = useToast();

const therapistId = (route.query.therapistId as string) ?? 'therapist-1';
const { data: therapist } = useTherapist(therapistId);

const days = Array.from({ length: 5 }).map((_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i + 1);
  return {
    iso: d.toISOString().slice(0, 10),
    label: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    num: d.getDate(),
    full: d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }),
  };
});
const selectedDay = ref(days[0].iso);
const selectedDayFull = computed(() => days.find((d) => d.iso === selectedDay.value)?.full ?? '');

const slots = [
  { time: '09:00', taken: false },
  { time: '10:30', taken: false },
  { time: '11:00', taken: true },
  { time: '14:00', taken: false },
  { time: '15:30', taken: false },
  { time: '16:30', taken: true },
];
const selectedSlot = ref<string | null>(null);
const type = ref<AppointmentType>('video');
const submitting = ref(false);

async function onSubmit() {
  if (!selectedSlot.value) return;
  submitting.value = true;
  try {
    const [h, m] = selectedSlot.value.split(':').map(Number);
    const slotDate = new Date(selectedDay.value);
    slotDate.setHours(h, m, 0, 0);
    await appointmentsApi.create({ therapistId, slot: slotDate.toISOString(), type: type.value });
    await toast.show('Appointment requested — you will be notified once confirmed.', 'success');
    router.replace({ name: 'care-hub' });
  } catch (error) {
    // Without this the screen simply stayed put on a rejected booking: no
    // error, no navigation, nothing to tell the client it had not worked.
    // The server's reasons are specific and worth showing — that the slot went
    // while they were choosing, or that they are not assigned to this
    // therapist yet — so its message is preferred to a generic one.
    const message =
      error instanceof ApiError
        ? error.message
        : 'We could not request that appointment. Check your connection and try again.';
    await toast.show(message, 'danger', { title: 'Appointment not requested' });
  } finally {
    submitting.value = false;
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
.cc-book__therapist {
  display: flex;
  gap: 12px;
  align-items: center;
}
.cc-book__daystrip {
  display: flex;
  gap: 8px;
}
.cc-book__day {
  flex: 1;
  padding: 10px 0;
  border-radius: var(--cc-radius-md);
  border: 1px solid var(--cc-line);
  background: var(--cc-surface-0);
  text-align: center;
  cursor: pointer;
}
.cc-book__day--selected {
  border: 1.5px solid var(--cc-color-primary);
  background: var(--cc-color-mist);
}
.cc-book__day-label {
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  color: var(--cc-ink-400);
}
.cc-book__day-num {
  font-family: var(--cc-font-mono);
  font-weight: 700;
  font-size: 19px;
}
.cc-book__slots {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.cc-book__slot {
  height: 44px;
  border-radius: var(--cc-radius-md);
  border: 1px solid var(--cc-line);
  background: var(--cc-surface-0);
  font-family: var(--cc-font-mono);
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
}
.cc-book__slot--selected {
  border: 1.5px solid var(--cc-color-primary);
  background: var(--cc-color-primary);
  color: #fff;
}
.cc-book__slot--taken {
  color: var(--cc-ink-300);
  background: var(--cc-surface-app);
  text-decoration: line-through;
  cursor: not-allowed;
}
.cc-book__types {
  display: flex;
  gap: 10px;
}
.cc-book__type {
  flex: 1;
  padding: 14px;
  border-radius: var(--cc-radius-md);
  border: 1px solid var(--cc-line);
  background: var(--cc-surface-0);
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cc-book__type--selected {
  border: 1.5px solid var(--cc-color-primary);
  background: var(--cc-color-mist);
}
.cc-screen__footer {
  padding: 11px 14px calc(25px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
.cc-book__summary {
  margin-bottom: 10px;
}
</style>
