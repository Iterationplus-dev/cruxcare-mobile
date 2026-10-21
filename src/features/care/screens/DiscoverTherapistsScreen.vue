<template>
  <ion-page class="cc-discover">
    <div class="cc-discover__header">
      <h1 class="cc-text-h1 cc-discover__title">Discover therapists</h1>
      <p class="cc-text-body cc-discover__subtitle">Find the right therapist for your needs</p>
    </div>
    <ion-content class="cc-screen">
      <AppPullToRefresh
        :query-keys="[['therapists'], ['case-files'], ['care', 'requests'], ['care-engagement']]"
      />
      <LoadingState v-if="engagementPending" label="Loading…" />

      <!-- A client holds one therapist at a time, so while they are with
           someone the directory is not shown at all: browsing people they
           cannot ask is an invitation to a refusal. Their own care is the only
           route offered from here. -->
      <div v-else-if="engagement" class="cc-screen__pad cc-discover__engaged">
        <AppCard class="cc-discover__engaged-card">
          <AppIcon name="favorite" :size="26" color="var(--cc-color-primary)" />
          <h2 class="cc-text-body-strong">You are with {{ formatPersonName(engagement.therapistName) }}</h2>
          <p class="cc-text-caption">
            CruxCare works with one therapist at a time, so the directory is closed while your
            care is open. Finish or end this course of care and you can choose again.
          </p>
          <AppButton @click="router.push({ name: 'care-mine' })">Go to your care</AppButton>
          <AppButton variant="secondary" @click="router.push({ name: 'care-requests' })">
            Manage this care
          </AppButton>
        </AppCard>
      </div>

      <LoadingState v-else-if="isPending" label="Loading therapists…" />

      <!-- Only when the *directory* is empty — which is why it is gated on
           there being no gender filter. `therapists` is the server's answer
           and gender filters server-side, so a filter nobody matches empties
           this list too. Ungated, this branch replaced the whole screen on
           such a filter: the search box and every chip went with it, the
           filter stayed applied, and on a tab root with no back button there
           was nothing left to press to undo it. -->
      <EmptyState
        v-else-if="directoryIsEmpty(therapists, gender)"
        icon="health_and_safety"
        title="No therapists available"
        message="No therapist is available to show right now. CruxCare can match you instead."
      />

      <div v-else class="cc-screen__pad">
        <!-- Your own care sits above the directory when there is any: the
             person already treating you is not something to go looking for. -->
        <AppCard v-if="hasOwnCare" class="cc-discover__own-care" style="padding: 0">
          <AppListRow
            title="Your care"
            :subtitle="ownCareSubtitle"
            icon="favorite"
            chevron
            clickable
            :divider="false"
            @click="router.push({ name: 'care-mine' })"
          />
        </AppCard>

        <!-- Where they are now, when they have asked the app to keep track.
             Coordinates rather than a place name: turning a point into a city
             needs a geocoder and there is none. -->
        <p v-if="location.enabled" class="cc-text-caption cc-discover__here">
          <AppIcon name="location_on" :size="14" color="var(--cc-color-primary)" />
          {{ hereLabel }}
        </p>

        <AppInput v-model="query" placeholder="Condition, name or discipline" class="cc-discover__search">
          <template #leading>
            <AppIcon name="search" :size="22" color="var(--cc-ink-400)" />
          </template>
        </AppInput>

        <div class="cc-discover__chips" role="tablist" aria-label="Filter therapists">
          <!-- Only offered when we know where the client is; without an address
               it would be a filter that silently matches nobody. -->
          <button
            v-if="myAddress"
            type="button"
            role="tab"
            class="cc-discover__chip"
            :class="{ 'cc-discover__chip--on': nearbyOnly }"
            :aria-selected="nearbyOnly"
            :aria-label="`Near me, ${nearbyCount} ${nearbyCount === 1 ? 'therapist' : 'therapists'}`"
            @click="nearbyOnly = !nearbyOnly"
          >
            <AppIcon name="location_on" :size="17" filled :color="nearbyOnly ? '#fff' : 'var(--cc-color-primary)'" />
            Near me
          </button>
          <!-- The way back to everyone. Clearing a specialty was only possible
               by tapping the chip you had already selected, which is not
               something anyone guesses. It leads because it is the default the
               list starts in. -->
          <button
            type="button"
            role="tab"
            class="cc-discover__chip"
            :class="{ 'cc-discover__chip--on': specialty === null }"
            :aria-selected="specialty === null"
            @click="specialty = null"
          >
            All {{ therapists?.length ?? 0 }}
          </button>
          <button
            v-for="c in chips"
            :key="c.value"
            type="button"
            role="tab"
            class="cc-discover__chip"
            :class="{ 'cc-discover__chip--on': specialty === c.value }"
            :aria-selected="specialty === c.value"
            :aria-label="`${c.value}, ${c.count} ${c.count === 1 ? 'therapist' : 'therapists'}`"
            @click="specialty = specialty === c.value ? null : c.value"
          >
            <AppIcon
              :name="specialtyIcon(c.value)"
              :size="17"
              :color="specialty === c.value ? '#fff' : 'var(--cc-color-primary)'"
            />
            {{ c.value }}
          </button>
        </div>

        <div class="cc-discover__chips" role="tablist" aria-label="Filter by gender">
          <button
            type="button"
            role="tab"
            class="cc-discover__chip"
            :class="{ 'cc-discover__chip--on': gender === null }"
            :aria-selected="gender === null"
            @click="gender = null"
          >
            Any gender
          </button>
          <button
            v-for="g in GENDER_FILTERS"
            :key="g.value"
            type="button"
            role="tab"
            class="cc-discover__chip"
            :class="{ 'cc-discover__chip--on': gender === g.value }"
            :aria-selected="gender === g.value"
            @click="gender = gender === g.value ? null : g.value"
          >
            {{ g.label }}
          </button>
        </div>

        <div class="cc-discover__results">
          <p class="cc-discover__count">
            {{ visible.length }} {{ visible.length === 1 ? 'therapist' : 'therapists' }} found
            <span v-if="nearbyOnly && myPlace">near {{ myPlace }}</span>
          </p>
          <!-- A native select under a styled label: the OS picker is the one
               people already know, and it needs no sheet of its own. -->
          <label v-if="visible.length > 1" class="cc-discover__sort">
            <AppIcon name="swap_vert" :size="20" color="var(--cc-ink-600)" />
            <span>Sort: {{ sortLabel }}</span>
            <AppIcon name="expand_more" :size="20" color="var(--cc-ink-600)" />
            <select v-model="sort" aria-label="Sort therapists">
              <option v-for="s in THERAPIST_SORTS" :key="s.value" :value="s.value">{{ s.label }}</option>
            </select>
          </label>
        </div>

        <!-- A gender filter empties the list differently from a search: a
             therapist who has recorded no gender matches no filter at all, so
             the list can be empty while therapists plainly exist. -->
        <EmptyState
          v-if="!visible.length"
          icon="search_off"
          :title="emptyTitle"
          :message="emptyMessage"
          :primary-action="hasFilters ? 'Clear filters' : undefined"
          @primary="clearFilters"
        />

        <AppCard
          v-for="t in visible"
          :key="t.id"
          class="cc-discover__card"
          :class="{ 'cc-discover__card--booked': t.fullyBooked }"
        >
          <div class="cc-discover__top">
            <span class="cc-discover__avatar" :class="{ 'cc-discover__avatar--photo': t.avatarUrl }">
              <AppAvatar :name="t.name" :src="t.avatarUrl ?? undefined" :size="58" />
            </span>
            <div class="cc-discover__id">
              <div class="cc-discover__name">{{ formatPersonName(t.name) }}</div>
              <div class="cc-discover__specialty">{{ t.specialties.join(' · ') || 'General practice' }}</div>
            </div>
            <div class="cc-discover__meta">
                <span
                  class="cc-discover__rating"
                  :class="{ 'cc-discover__rating--new': t.rating === null }"
                  :aria-label="t.rating === null ? 'Not rated yet' : `${t.rating.toFixed(1)} out of 5 rating`"
                >
                  <AppIcon
                    name="star"
                    :size="15"
                    filled
                    :color="t.rating === null ? 'var(--cc-color-primary)' : 'var(--cc-color-warning)'"
                  />
                  {{ t.rating === null ? 'New' : t.rating.toFixed(1) }}
                </span>
                <span v-if="t.location" class="cc-discover__location">
                  <AppIcon name="location_on" :size="16" color="var(--cc-ink-400)" />
                  <span>{{ t.location }}</span>
                </span>
            </div>
            <button
              type="button"
              class="cc-discover__view"
              :aria-label="`View ${formatPersonName(t.name)}'s profile`"
              @click="router.push({ name: 'therapist-detail', params: { id: t.id } })"
            >
              View profile
              <AppIcon name="chevron_right" :size="18" color="var(--cc-color-primary)" />
            </button>
          </div>

          <!-- The design shows the next few slots and a "+N slots" count. The
               directory carries one, so one is shown rather than implying more. -->
          <div class="cc-discover__slots">
            <span v-if="formatNextSlot(t.nextAvailableSlot)" class="cc-discover__slot">
              <AppIcon name="schedule" :size="16" color="var(--cc-color-primary)" />
              {{ formatNextSlot(t.nextAvailableSlot) }}
            </span>
            <!-- Three different things produce no slot and they are not the
                 same statement. Someone who has never set working hours has an
                 empty diary, so "Fully booked" is false about them. -->
            <span v-else class="cc-discover__slot cc-discover__slot--none">
              <AppIcon name="schedule" :size="16" color="var(--cc-ink-400)" />
              {{ slotAbsenceLabel(t) }}
            </span>
          </div>
        </AppCard>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppIcon,
  AppInput,
  AppListRow,
  AppPullToRefresh,
} from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { useCareEngagement, useTherapists } from '@/composables/useTherapists';
import {
  GENDER_FILTERS,
  directoryIsEmpty,
  genderFilterEmptyMessage,
} from '@/features/care/engagement';
import type { TherapistGender } from '@/types/care';
import { useCaseFiles } from '@/composables/useCaseFiles';
import { useCareRequests } from '@/composables/useCareRequests';
import {
  THERAPIST_SORTS,
  discoverTherapists,
  formatNextSlot,
  isNearby,
  slotAbsenceLabel,
  sortTherapists,
  specialtyChips,
  type TherapistSort,
} from '@/features/care/discoverTherapists';
import { useAuthStore } from '@/stores/auth';
import { useLocationStore } from '@/stores/location';
import { formatCoordinates } from '@/services/deviceLocation';
import { formatAddress } from '@/types/user';
import { formatPersonName } from '@/utils/personName';

/** CD2 · Discover therapists — the Care tab's own screen. */
const router = useRouter();
/** Server-side, so it lives in the query rather than filtering the page we
 *  happen to hold. */
const gender = ref<TherapistGender | null>(null);

/** Who this client is already tied to, if anyone. Resolved before the
 *  directory, because it decides whether there is a directory. */
const { data: engagementState, isPending: engagementPending } = useCareEngagement();
const engagement = computed(() => engagementState.value?.engagement ?? null);

// Not merely "no engagement": until the engagement call has answered, we do
// not yet know whether this client is allowed a directory, and `undefined`
// would read as "free" and fetch it anyway. Waiting is what keeps another
// therapist's details off an engaged client's device.
const { data: page, isPending } = useTherapists(
  gender,
  () => !engagementPending.value && !engagement.value,
);
const therapists = computed(() => page.value?.data);

const query = ref('');
const specialty = ref<string | null>(null);
const chips = computed(() => specialtyChips(therapists.value));
const nearbyOnly = ref(false);

/** Kept current while this screen is open, if the user has location on. */
const location = useLocationStore();
onMounted(async () => {
  await location.hydrate();
  await location.refresh();
});

const hereLabel = computed(() => {
  if (location.busy) return 'Finding your location…';
  if (location.coordinates) return `You are at ${formatCoordinates(location.coordinates)}`;
  return 'Location is on, but no position yet';
});

/** Where this client is, as the server knows it. Absent until it returns an
 *  address, which is what gates the Near me chip. */
const auth = useAuthStore();
const myAddress = computed(() => auth.user?.address ?? null);
const myPlace = computed(() => formatAddress(myAddress.value));

const sort = ref<TherapistSort>('relevance');
const sortLabel = computed(() => THERAPIST_SORTS.find((s) => s.value === sort.value)?.label ?? 'Relevance');

const visible = computed(() =>
  sortTherapists(
    discoverTherapists(therapists.value, query.value, specialty.value, {
      address: myAddress.value,
      nearbyOnly: nearbyOnly.value,
    }),
    sort.value,
  ),
);

/** A picture beside each condition chip. Specialties are free text from the
 *  directory, so this matches loosely and falls back to a general one. */
function specialtyIcon(value: string): string {
  const name = value.toLowerCase();
  if (/massage|physio|body|chiro/.test(name)) return 'eco';
  if (/sleep/.test(name)) return 'bedtime';
  if (/mind|mental|counsel|psych/.test(name)) return 'psychology';
  return 'spa';
}

const emptyTitle = computed(() => {
  if (gender.value) return 'Nobody listed';
  return nearbyOnly.value ? 'None near you' : 'No match';
});

const emptyMessage = computed(() => {
  if (nearbyOnly.value) {
    return `No therapist here is listed in ${myPlace.value ?? 'your area'}. Turn off Near me to see everyone.`;
  }
  if (gender.value) return genderFilterEmptyMessage(gender.value);
  return 'No therapist here matches what you searched for.';
});

const hasFilters = computed(
  () => !!query.value.trim() || !!specialty.value || !!gender.value || nearbyOnly.value,
);

/**
 * One way out of every empty list.
 *
 * The chips are the only control that undoes a filter, and they are in a
 * horizontally scrolling row — by the time a client has tapped the last one,
 * "Any gender" is off the left of the screen. An empty result is exactly when
 * the escape has to be in front of them rather than scrolled away.
 */
function clearFilters() {
  query.value = '';
  specialty.value = null;
  gender.value = null;
  nearbyOnly.value = false;
}

const nearbyCount = computed(
  () => (therapists.value ?? []).filter((t) => isNearby(t, myAddress.value)).length,
);

/** Whether this client has care of their own to return to, rather than only a
 *  directory to browse. */
const { data: caseFiles } = useCaseFiles();
const { data: requests } = useCareRequests();
const hasOwnCare = computed(
  () => !!caseFiles.value?.data.length || !!requests.value?.data.length,
);
const ownCareSubtitle = computed(() =>
  caseFiles.value?.data.length
    ? 'Your therapist, sessions and health profile'
    : 'Track the request you sent',
);
</script>

<style scoped>
.cc-discover__engaged {
  padding-top: 24px;
}
.cc-discover__engaged-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
  padding: 20px;
}
.cc-discover__engaged-card h2 {
  margin: 0;
  font-size: 17px;
}
.cc-discover__engaged-card p {
  margin: 0 0 4px;
}
.cc-discover__engaged-card > :deep(.cc-btn) {
  width: 100%;
}
.cc-screen {
  --background: var(--cc-surface-app);
}
/* The header sits outside ion-content, so it owns the status-bar inset —
   without it the title is drawn over the clock. Matches the care hub's. */
.cc-discover__header {
  padding: calc(env(safe-area-inset-top) + 18px) 20px 6px;
}
/* One botanical background behind header and list together. The app gives
   every ion-content.cc-screen its own copy, which restarts the art where the
   list begins and leaves a seam under this taller header. */
.cc-discover {
  background: var(--cc-surface-app) url('@/assets/images/screen-bg.png') center top / cover no-repeat;
}
.cc-discover ion-content.cc-screen {
  --background: transparent !important;
}
.cc-discover__own-care :deep(.cc-row__title) {
  font-weight: 700;
  font-size: 16px;
}
.cc-discover__title {
  margin: 0;
  font-size: 28px;
  line-height: 34px;
}
.cc-discover__subtitle {
  margin: 4px 0 0;
  font-size: 14.5px;
  color: var(--cc-ink-600);
}
.cc-discover__search :deep(.cc-field__control) {
  min-height: 52px;
  border-radius: var(--cc-radius-lg);
  background: var(--cc-surface-0);
}
.cc-screen__pad {
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cc-discover__chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.cc-discover__chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 8px 15px;
  border-radius: var(--cc-radius-pill);
  border: 1px solid var(--cc-line);
  background: var(--cc-surface-0);
  font-family: var(--cc-font-interface);
  font-size: 13px;
  font-weight: 600;
  color: var(--cc-ink-900);
  cursor: pointer;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.cc-discover__chip--on {
  background: var(--cc-color-primary);
  border-color: var(--cc-color-primary);
  color: #fff;
}
.cc-discover__here {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
}
.cc-discover__results {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 2px;
}
.cc-discover__count {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 13.5px;
  color: var(--cc-ink-600);
}
.cc-discover__sort {
  position: relative;
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: var(--cc-touch-min);
  font-family: var(--cc-font-interface);
  font-size: 13.5px;
  color: var(--cc-ink-900);
}
.cc-discover__sort select {
  position: absolute;
  inset: 0;
  width: 100%;
  opacity: 0;
  cursor: pointer;
}
.cc-discover__card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 18px;
}
.cc-discover__avatar {
  flex: none;
  display: inline-flex;
  padding: 3px;
  border-radius: 50%;
}
/* The mint ring is for portraits; initials already sit on a solid disc. */
.cc-discover__avatar--photo {
  background: var(--cc-color-mist);
  box-shadow: 0 0 0 2px rgba(14, 124, 107, 0.12);
}
.cc-discover__name {
  font-family: var(--cc-font-interface);
  font-size: 16.5px;
  font-weight: 700;
  line-height: 22px;
  color: var(--cc-ink-900);
  overflow-wrap: anywhere;
}
.cc-discover__specialty {
  font-family: var(--cc-font-interface);
  font-size: 13.5px;
  color: var(--cc-ink-600);
}
.cc-discover__view {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 36px;
  padding: 6px 10px 6px 14px;
  border: 1.5px solid var(--cc-color-primary);
  border-radius: var(--cc-radius-pill);
  background: var(--cc-surface-0);
  font-family: var(--cc-font-interface);
  font-size: 13px;
  font-weight: 700;
  color: var(--cc-color-primary);
  cursor: pointer;
  white-space: nowrap;
}
/* Fully booked stays visible, per the design, but reads as unavailable. */
.cc-discover__card--booked {
  opacity: 0.72;
}
.cc-discover__top {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  column-gap: 12px;
  align-items: start;
}
.cc-discover__avatar {
  grid-column: 1;
  grid-row: 1 / span 2;
}
.cc-discover__id {
  grid-column: 2;
  grid-row: 1;
}
.cc-discover__view {
  grid-column: 3;
  grid-row: 1;
}
.cc-discover__id {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cc-discover__meta {
  grid-column: 2 / span 2;
  grid-row: 2;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 10px;
  margin-top: 6px;
  font-family: var(--cc-font-interface);
  font-size: 13px;
  color: var(--cc-ink-600);
}
.cc-discover__rating {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: var(--cc-radius-pill);
  background: var(--cc-surface-app);
  font-weight: 700;
  color: var(--cc-ink-900);
  font-variant-numeric: tabular-nums;
}
.cc-discover__rating--new {
  background: var(--cc-color-mist);
  color: var(--cc-color-primary);
}
.cc-discover__location {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  max-width: 100%;
}
.cc-discover__location span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cc-discover__slots {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cc-discover__slot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--cc-radius-pill);
  background: var(--cc-color-mist);
  font-family: var(--cc-font-interface);
  font-size: 12px;
  font-weight: 600;
  color: var(--cc-color-primary);
}
.cc-discover__slot--none {
  background: var(--cc-surface-app);
  color: var(--cc-ink-600);
}
</style>
