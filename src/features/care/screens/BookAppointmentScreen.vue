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

        <!-- CD3 leads with how the session happens, then when. -->
        <div class="cc-book__types">
          <button
            type="button"
            class="cc-book__type"
            :class="{ 'cc-book__type--selected': type === 'video' }"
            @click="type = 'video'"
          >
            <AppIcon name="videocam" :size="22" :color="type === 'video' ? 'var(--cc-color-primary)' : 'var(--cc-ink-600)'" />
            <div class="cc-text-body-strong" style="font-size: 14.5px">Video</div>
          </button>
          <button
            type="button"
            class="cc-book__type"
            :class="{ 'cc-book__type--selected': type === 'in-person' }"
            @click="type = 'in-person'"
          >
            <AppIcon name="store" :size="22" :color="type === 'in-person' ? 'var(--cc-color-primary)' : 'var(--cc-ink-600)'" />
            <div class="cc-text-body-strong" style="font-size: 14.5px">In clinic</div>
          </button>
        </div>

        <div class="cc-book__month">
          <button type="button" class="cc-book__month-nav" aria-label="Previous month" @click="shiftMonth(-1)">
            <AppIcon name="chevron_left" :size="20" color="var(--cc-ink-600)" />
          </button>
          <span class="cc-text-body-strong" style="font-size: 15px">{{ monthTitle }}</span>
          <button type="button" class="cc-book__month-nav" aria-label="Next month" @click="shiftMonth(1)">
            <AppIcon name="chevron_right" :size="20" color="var(--cc-ink-600)" />
          </button>
        </div>

        <AppCard class="cc-book__calendar">
          <div class="cc-book__weekdays">
            <span v-for="(w, i) in WEEKDAY_LABELS" :key="i">{{ w }}</span>
          </div>
          <div class="cc-book__grid">
            <template v-for="(cell, i) in grid" :key="i">
              <span v-if="!cell.iso" class="cc-book__cell cc-book__cell--blank" />
              <button
                v-else
                type="button"
                class="cc-book__cell"
                :class="{
                  'cc-book__cell--selected': cell.iso === selectedDay,
                  'cc-book__cell--disabled': cell.disabled,
                }"
                :disabled="cell.disabled"
                :aria-pressed="cell.iso === selectedDay"
                @click="selectDay(cell.iso)"
              >
                {{ cell.day }}
              </button>
            </template>
          </div>
        </AppCard>

        <div v-if="selectedDay" class="cc-text-body-strong" style="font-size: 16px">
          {{ selectedDayFull }}
        </div>
        <div v-if="selectedDay" class="cc-book__slots">
          <button
            v-for="time in SLOT_TIMES"
            :key="time"
            type="button"
            class="cc-book__slot"
            :class="{ 'cc-book__slot--selected': time === selectedSlot }"
            @click="selectedSlot = time"
          >
            {{ time }}
          </button>
        </div>
        <!-- No slot is marked taken: the directory carries no availability, and
             a struck-through time we invented would be a lie either way. The
             server refuses a slot it cannot honour and that reason is shown. -->
        <p class="cc-text-caption">
          Times are requests. Your therapist confirms the one that works, and the
          cost is set once they have assessed you and agreed a treatment plan.
        </p>
      </div>

      <div class="cc-screen__footer">
        <div v-if="selectedSlot" class="cc-book__summary">
          <span class="cc-text-caption">{{ selectedDayFull }} · {{ selectedSlot }} · {{ type === 'video' ? 'video' : 'in clinic' }}</span>
        </div>
        <AppButton :disabled="!selectedSlot" :loading="submitting" @click="onSubmit">
          Request this time
        </AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  SLOT_TIMES,
  WEEKDAY_LABELS,
  formatDayHeading,
  monthGrid,
  monthLabel,
} from '@/features/care/bookingCalendar';
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

/**
 * No fallback. This defaulted to a hard-coded `therapist-1`, so a caller that
 * forgot the query param booked against a therapist that does not exist —
 * which the server rejected, silently, from a screen that looked fine.
 */
const therapistId = (route.query.therapistId as string) ?? '';
const { data: therapist } = useTherapist(therapistId);

const today = new Date();
const viewYear = ref(today.getFullYear());
const viewMonth = ref(today.getMonth());

const monthTitle = computed(() => monthLabel(viewYear.value, viewMonth.value));
const grid = computed(() => monthGrid(viewYear.value, viewMonth.value, today));

const selectedDay = ref<string | null>(null);
const selectedDayFull = computed(() =>
  selectedDay.value ? formatDayHeading(selectedDay.value) : '',
);
const selectedSlot = ref<string | null>(null);

function selectDay(iso: string) {
  selectedDay.value = iso;
  // A time chosen for one day means nothing on another.
  selectedSlot.value = null;
}

function shiftMonth(delta: number) {
  const next = new Date(viewYear.value, viewMonth.value + delta, 1);
  viewYear.value = next.getFullYear();
  viewMonth.value = next.getMonth();
}

const type = ref<AppointmentType>('video');
const submitting = ref(false);

async function onSubmit() {
  if (!selectedSlot.value || !selectedDay.value) return;
  if (!therapistId) {
    await toast.show('Open this from a therapist so we know who to book with.', 'warning', {
      title: 'No therapist chosen',
    });
    return;
  }
  submitting.value = true;
  try {
    const [h, m] = selectedSlot.value.split(':').map(Number);
    // Parsed as local time: a bare YYYY-MM-DD is treated as UTC, which shifts
    // the booking a day for anyone behind it.
    const slotDate = new Date(`${selectedDay.value}T00:00:00`);
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
.cc-book__month {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cc-book__month-nav {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-pill);
  background: var(--cc-surface-0);
  cursor: pointer;
}
.cc-book__calendar {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cc-book__weekdays,
.cc-book__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.cc-book__weekdays span {
  text-align: center;
  font-family: var(--cc-font-interface);
  font-size: 11px;
  font-weight: 600;
  color: var(--cc-ink-400);
}
.cc-book__cell {
  aspect-ratio: 1;
  min-height: 40px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: var(--cc-radius-pill);
  background: transparent;
  font-family: var(--cc-font-interface);
  font-size: 14px;
  font-weight: 600;
  color: var(--cc-ink-900);
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}
.cc-book__cell--blank {
  cursor: default;
}
.cc-book__cell--disabled {
  color: var(--cc-ink-300);
  cursor: not-allowed;
}
.cc-book__cell--selected {
  background: var(--cc-color-primary);
  color: #fff;
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
