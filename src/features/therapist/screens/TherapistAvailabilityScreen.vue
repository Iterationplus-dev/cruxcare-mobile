<template>
  <ion-page>
    <AppHeader title="Availability" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <template v-if="isPending">
          <AppCard v-for="n in 3" :key="n" class="cc-hours__skeleton" />
        </template>

        <EmptyState
          v-else-if="notATherapist"
          icon="badge"
          title="No therapist profile yet"
          message="Availability is part of a therapist profile. Add the therapist role to set your hours."
        />

        <EmptyState
          v-else-if="loadError"
          icon="cloud_off"
          title="Couldn't load your hours"
          :message="loadErrorMessage"
          primary-action="Try again"
          @primary="refetch()"
        />

        <template v-else>
          <p class="cc-hours__intro">
            Clients can only book the hours you set here. Until you switch a day on, nothing on
            your calendar is bookable.
          </p>

          <!-- The one thing a therapist most needs to know on arrival, and the
               state every account starts in. Said plainly rather than left to
               be inferred from seven switches all being off. -->
          <AppCard v-if="noneSet" class="cc-hours__notice">
            <AppIcon name="event_busy" :size="20" color="var(--cc-color-warning-text)" />
            <p>
              You have no hours set, so clients cannot book you yet. Switch on the days you work
              and save.
            </p>
          </AppCard>

          <AppCard style="padding: 0">
            <div
              v-for="(day, index) in rows"
              :key="day.weekday"
              class="cc-hours__day"
              :class="{ 'cc-hours__day--last': index === rows.length - 1 }"
            >
              <div class="cc-hours__row">
                <span class="cc-text-body-strong" style="font-size: 14.5px">{{ day.label }}</span>
                <label class="cc-toggle">
                  <input
                    v-model="day.enabled"
                    type="checkbox"
                    :aria-label="`Work on ${day.label}`"
                  />
                  <span class="cc-toggle__track"><span class="cc-toggle__thumb" /></span>
                </label>
              </div>

              <div v-if="day.enabled" class="cc-hours__times">
                <AppSheetSelect
                  v-model="day.opensAt"
                  label="Opens"
                  :title="`${day.label} opens`"
                  :options="times"
                />
                <AppSheetSelect
                  v-model="day.closesAt"
                  label="Closes"
                  :title="`${day.label} closes`"
                  :options="times"
                />
              </div>

              <p v-if="day.enabled && errorFor(day)" class="cc-hours__error" role="alert">
                {{ errorFor(day) }}
              </p>
            </div>
          </AppCard>

          <p class="cc-text-caption">
            {{ timezoneLabel }} Existing bookings are never cancelled by a change here — switching
            a day off only stops new ones.
          </p>
        </template>
      </div>

      <div v-if="!isPending && !notATherapist && !loadError" class="cc-screen__footer">
        <AppButton :disabled="!dirty || hasErrors" :loading="saving" @click="onSave">
          Save hours
        </AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppSheetSelect,
} from '@/components/ui';
import { EmptyState } from '@/components/state';
import { useToast } from '@/composables/useToast';
import { therapistsApi } from '@/api/therapists.api';
import {
  DEFAULT_CLOSES,
  DEFAULT_OPENS,
  WEEK,
  timeOptions,
  toWorkingDays,
  windowError,
} from '@/features/therapist/workingHours';
import { ApiError } from '@/types/api';
import type { Weekday } from '@/types/care';

/**
 * TD3 · the therapist's own rota.
 *
 * This screen used to be seven toggles bound to a local array that defaulted to
 * Monday–Friday and saved nowhere. That was the same invented availability the
 * server was producing: it told a therapist they were bookable weekdays without
 * ever asking, and told a client the same. Both ends now read one record the
 * therapist actually set.
 */

interface DayRow {
  weekday: Weekday;
  label: string;
  enabled: boolean;
  opensAt: string;
  closesAt: string;
}

const toast = useToast();
const queryClient = useQueryClient();
const times = timeOptions();

const {
  data: rota,
  isPending,
  error: loadError,
  refetch,
} = useQuery({
  queryKey: ['therapist', 'my-availability'],
  queryFn: () => therapistsApi.myAvailability(),
  retry: false,
});

/** The server's own signal that this account has no therapist profile. Only a
 *  403 says that; anything else is a load that failed and can be retried. */
const notATherapist = computed(
  () => loadError.value instanceof ApiError && loadError.value.status === 403,
);

const loadErrorMessage = computed(() =>
  loadError.value instanceof ApiError
    ? loadError.value.message
    : 'Check your connection and try again.',
);

const rows = reactive<DayRow[]>(
  WEEK.map((day) => ({
    weekday: day.weekday,
    label: day.label,
    enabled: false,
    opensAt: DEFAULT_OPENS,
    closesAt: DEFAULT_CLOSES,
  })),
);

const saving = ref(false);

/** The days as the server returned them, in the therapist's own clock. */
const saved = computed(() => rota.value?.data ?? null);

/**
 * Whose clock these hours are in. The server names it so this screen does not
 * have to guess — before it did, a therapist in Lagos setting "09:00" was
 * setting 10:00 their own time with nothing on screen saying so.
 */
const timezoneLabel = computed(() => {
  const zone = rota.value?.meta?.timezone;
  if (!zone) return 'Times are in UTC. Set your timezone to use your own clock.';
  return `Times are in your own timezone (${zone.replace(/_/g, ' ')}).`;
});

/**
 * Seeded from the server, and re-seeded if the rota is refetched while this
 * screen sits open. Days the therapist does not work keep the default times in
 * the fields so switching one on offers a sensible starting point rather than
 * an empty pair of selects — nothing is stored until it is saved.
 */
watch(
  saved,
  (next) => {
    if (!next) return;
    for (const row of rows) {
      const match = next.find((day) => day.weekday === row.weekday);
      row.enabled = match !== undefined;
      row.opensAt = match?.opensAt ?? DEFAULT_OPENS;
      row.closesAt = match?.closesAt ?? DEFAULT_CLOSES;
    }
  },
  { immediate: true },
);

const noneSet = computed(() => (saved.value?.length ?? 0) === 0);

function errorFor(day: DayRow): string | null {
  return windowError(day.opensAt, day.closesAt);
}

const hasErrors = computed(() => rows.some((row) => row.enabled && errorFor(row) !== null));

const dirty = computed(() => {
  const next = toWorkingDays(rows);
  const current = saved.value ?? [];

  if (next.length !== current.length) return true;

  return next.some((day, index) => {
    const was = current[index];
    return (
      was === undefined ||
      was.weekday !== day.weekday ||
      was.opensAt !== day.opensAt ||
      was.closesAt !== day.closesAt
    );
  });
});

async function onSave() {
  saving.value = true;
  try {
    const days = toWorkingDays(rows);
    const updated = await therapistsApi.updateMyAvailability(days);
    queryClient.setQueryData(['therapist', 'my-availability'], updated);
    // A client's booking calendar and the directory's next-slot line are both
    // built from this; leaving them cached would show the old hours.
    await queryClient.invalidateQueries({ queryKey: ['therapists'] });

    await toast.show(
      days.length === 0
        ? 'Your hours are cleared. Clients cannot book you until you set some.'
        : 'Your hours are saved',
      days.length === 0 ? 'warning' : 'success',
    );
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'We could not save your hours. Please try again.';
    await toast.show(message, 'danger', { title: 'Could not save' });
  } finally {
    saving.value = false;
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
  gap: 14px;
}
.cc-screen__footer {
  position: sticky;
  bottom: 0;
  padding: 12px 16px calc(12px + var(--ion-safe-area-bottom, 0px));
  background: var(--cc-surface-app);
  border-top: 1px solid var(--cc-line);
}
.cc-hours__intro {
  margin: 0;
  color: var(--cc-ink-600);
  font-size: 13px;
  line-height: 1.5;
}
.cc-hours__skeleton {
  height: 64px;
  opacity: 0.5;
}
.cc-hours__notice {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}
.cc-hours__notice p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cc-ink-700);
}
.cc-hours__day {
  padding: 12px 16px;
  border-bottom: 1px solid var(--cc-line);
}
.cc-hours__day--last {
  border-bottom: none;
}
.cc-hours__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.cc-hours__times {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 10px;
}
.cc-hours__error {
  margin: 8px 0 0;
  font-size: 12.5px;
  color: var(--cc-color-danger);
}
.cc-toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 24px;
  flex: none;
}
.cc-toggle input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
}
.cc-toggle__track {
  display: block;
  width: 40px;
  height: 24px;
  border-radius: 999px;
  background: var(--cc-line);
  padding: 2px;
  box-sizing: border-box;
}
.cc-toggle__thumb {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: #fff;
  transition: transform var(--cc-motion-fast) var(--cc-ease-out);
}
.cc-toggle input:checked + .cc-toggle__track {
  background: var(--cc-color-primary);
}
.cc-toggle input:checked + .cc-toggle__track .cc-toggle__thumb {
  transform: translateX(16px);
}
</style>
