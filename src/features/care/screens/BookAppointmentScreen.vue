<template>
  <ion-page>
    <AppHeader :title="isRescheduling ? 'Move this visit' : 'Book a visit'" show-back :botanical="false" />
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

        <!-- A month of greyed-out days with no explanation is the worst of
             both worlds, so the reason is named. Which reason matters: an
             empty range means "cannot be booked", not specifically "has set no
             hours", and the three causes are different statements about a
             person. -->
        <AppCard v-if="unbookableReason" class="cc-book__notice">
          <AppIcon name="event_busy" :size="20" color="var(--cc-color-warning-text)" />
          <p>{{ unbookableReason }}</p>
        </AppCard>

        <div v-if="selectedDay" class="cc-text-body-strong" style="font-size: 16px">
          {{ selectedDayFull }}
        </div>
        <!-- Every time here is one the therapist set, minus what is already
             booked. The fixed 09:00-17:00 list this used to render was the same
             invented availability the server was producing. -->
        <div v-if="selectedDay && daySlots.length" class="cc-book__slots">
          <button
            v-for="slot in daySlots"
            :key="slot.iso"
            type="button"
            class="cc-book__slot"
            :class="{ 'cc-book__slot--selected': slot.iso === selectedSlot?.iso }"
            @click="selectedSlot = slot"
          >
            {{ slot.label }}
          </button>
        </div>
        <p v-else-if="selectedDay" class="cc-text-caption">
          Nothing is open on this day.
        </p>
        <p class="cc-text-caption">
          Times are requests. Your therapist confirms the one that works, and the
          cost is set once they have assessed you and agreed a treatment plan.
        </p>
      </div>

      <div class="cc-screen__footer">
        <div v-if="selectedSlot" class="cc-book__summary">
          <span class="cc-text-caption">{{ selectedDayFull }} · {{ selectedSlot.label }} · {{ type === 'video' ? 'video' : 'in clinic' }}</span>
        </div>
        <AppButton :disabled="!selectedSlot" :loading="submitting" @click="onSubmit">
          {{ isRescheduling ? 'Move to this time' : 'Request this time' }}
        </AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  WEEKDAY_LABELS,
  formatDayHeading,
  monthGrid,
  monthLabel,
  openDayIndex,
  slotsFor,
  type OpenSlot,
} from '@/features/care/bookingCalendar';
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppAvatar, AppButton, AppCard, AppHeader, AppIcon } from '@/components/ui';
import { appointmentsApi } from '@/api/appointments.api';
import { therapistsApi } from '@/api/therapists.api';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { ApiError } from '@/types/api';
import { useTherapist } from '@/composables/useTherapists';
import { useToast } from '@/composables/useToast';
import type { AppointmentType } from '@/types/care';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();

/**
 * No fallback. This defaulted to a hard-coded `therapist-1`, so a caller that
 * forgot the query param booked against a therapist that does not exist —
 * which the server rejected, silently, from a screen that looked fine.
 */
const therapistId = (route.query.therapistId as string) ?? '';

/**
 * Set when the screen was opened to move an existing appointment rather than
 * create one. Without it, "Reschedule" produced a second booking and left the
 * original where it was — two sessions where the client asked for one moved.
 */
const rescheduleId = (route.query.rescheduleId as string) ?? '';
const isRescheduling = !!rescheduleId;
const { data: therapist } = useTherapist(therapistId);

const today = new Date();
const viewYear = ref(today.getFullYear());
const viewMonth = ref(today.getMonth());

const monthTitle = computed(() => monthLabel(viewYear.value, viewMonth.value));

/**
 * The therapist's open days for the month on screen.
 *
 * Refetched per month rather than once for a fixed window, so paging forward
 * asks about the month being looked at instead of greying it out for lack of
 * an answer.
 */
const monthRange = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1);
  const last = new Date(viewYear.value, viewMonth.value + 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: iso(first), to: iso(last) };
});

const { data: availability } = useQuery({
  queryKey: ['therapists', therapistId, 'availability', monthRange],
  queryFn: () => therapistsApi.availability(therapistId, monthRange.value.from, monthRange.value.to),
  enabled: !!therapistId,
});

const openDays = computed(() => openDayIndex(availability.value));

/**
 * The server returns an empty range whenever nobody can book: the therapist has
 * set no hours, is at capacity, or has marked themselves unavailable. Those are
 * three different things to say about someone, so the wording comes from the
 * therapist record rather than being guessed from the empty array — telling a
 * client that a fully-booked therapist "has not set hours" is exactly the
 * false statement the directory card used to make in reverse.
 */
const nothingBookable = computed(
  () => availability.value !== undefined && availability.value.length === 0,
);

const unbookableReason = computed(() => {
  if (!nothingBookable.value) return null;
  const name = therapist.value?.name ?? 'This therapist';

  if (therapist.value?.fullyBooked) {
    return `${name} is not taking new bookings right now. Try another therapist, or ask CruxCare to match you.`;
  }

  if (therapist.value?.schedulePublished === false) {
    return `${name} has not set booking hours yet, so there is nothing to request. Try another therapist, or ask CruxCare to match you.`;
  }

  // Reachable when the record is still loading, or from an older server that
  // sends no schedulePublished — say what is true either way.
  return `${name} has no times open at the moment. Try another therapist, or ask CruxCare to match you.`;
});

const grid = computed(() =>
  // Nothing bookable greys the whole month: leaving days tappable so each one
  // can report "nothing open" makes the client work it out a day at a time.
  monthGrid(viewYear.value, viewMonth.value, today, openDays.value, nothingBookable.value),
);

const selectedDay = ref<string | null>(null);
const selectedDayFull = computed(() =>
  selectedDay.value ? formatDayHeading(selectedDay.value) : '',
);
const selectedSlot = ref<OpenSlot | null>(null);
const daySlots = computed(() => slotsFor(selectedDay.value, openDays.value));

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
    // The exact instant the server offered, carried through untouched. Rebuilding
    // it from the label here is what made a tap on "10:00" book 09:00 UTC.
    const slot = selectedSlot.value.iso;
    if (isRescheduling) {
      await appointmentsApi.reschedule(rescheduleId, slot, type.value);
      await toast.show('Your session has been moved — your therapist will confirm the new time.', 'success');
    } else {
      await appointmentsApi.create({ therapistId, slot, type: type.value });
      await toast.show('Appointment requested — you will be notified once confirmed.', 'success');
    }
    await queryClient.invalidateQueries({ queryKey: ['appointments'] });
    router.replace({ name: 'care-hub' });
  } catch (error) {
    // Without this the screen simply stayed put on a rejected booking: no
    // error, no navigation, nothing to tell the client it had not worked.
    // The server's reasons are specific and worth showing — that the slot went
    // while they were choosing, or that they are not assigned to this
    // therapist yet — so its message is preferred to a generic one.
    const message =
      error instanceof ApiError
        ? error
        : 'We could not request that appointment. Check your connection and try again.';
    await toast.show(message, 'danger', { title: 'Appointment not requested' });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.cc-book__notice {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.cc-book__notice p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cc-ink-700);
}
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
