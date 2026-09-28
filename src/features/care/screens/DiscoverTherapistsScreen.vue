<template>
  <ion-page>
    <div class="cc-discover__header">
      <h1 class="cc-text-h1" style="margin: 0">Discover therapists</h1>
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
          <h2 class="cc-text-body-strong">You are with {{ engagement.therapistName }}</h2>
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
        <AppCard v-if="hasOwnCare" style="padding: 0">
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

        <AppInput v-model="query" placeholder="Condition, name or discipline" />

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
            @click="nearbyOnly = !nearbyOnly"
          >
            Near me {{ nearbyCount }}
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
            @click="specialty = specialty === c.value ? null : c.value"
          >
            {{ c.value }} {{ c.count }}
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

        <p class="cc-text-caption cc-discover__count">
          {{ visible.length }} {{ visible.length === 1 ? 'therapist' : 'therapists' }}
          <span v-if="nearbyOnly && myPlace">near {{ myPlace }}</span>
        </p>

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
            <AppAvatar :name="t.name" :src="t.avatarUrl ?? undefined" :size="46" />
            <div class="cc-discover__id">
              <div class="cc-text-body-strong" style="font-size: 15px">{{ t.name }}</div>
              <div class="cc-text-caption">{{ t.specialties.join(' · ') || 'General practice' }}</div>
              <div class="cc-discover__meta">
                <span
                  class="cc-discover__rating"
                  :aria-label="t.rating === null ? 'Not rated yet' : `${t.rating.toFixed(1)} out of 5 rating`"
                >
                  <AppIcon
                    name="star"
                    :size="15"
                    filled
                    :color="t.rating === null ? 'var(--cc-ink-300)' : 'var(--cc-color-warning)'"
                  />
                  {{ t.rating === null ? 'New' : t.rating.toFixed(1) }}
                </span>
                <span v-if="t.location" class="cc-discover__location">{{ t.location }}</span>
              </div>
            </div>
          </div>

          <!-- The design shows the next few slots and a "+N slots" count. The
               directory carries one, so one is shown rather than implying more. -->
          <div class="cc-discover__slots">
            <span v-if="formatNextSlot(t.nextAvailableSlot)" class="cc-discover__slot">
              {{ formatNextSlot(t.nextAvailableSlot) }}
            </span>
            <!-- Three different things produce no slot and they are not the
                 same statement. Someone who has never set working hours has an
                 empty diary, so "Fully booked" is false about them. -->
            <span v-else class="cc-discover__slot cc-discover__slot--none">
              {{ slotAbsenceLabel(t) }}
            </span>
          </div>

          <AppButton
            variant="secondary"
            @click="router.push({ name: 'therapist-detail', params: { id: t.id } })"
          >
            View profile
          </AppButton>
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
  discoverTherapists,
  formatNextSlot,
  isNearby,
  slotAbsenceLabel,
  specialtyChips,
} from '@/features/care/discoverTherapists';
import { useAuthStore } from '@/stores/auth';
import { useLocationStore } from '@/stores/location';
import { formatCoordinates } from '@/services/deviceLocation';
import { formatAddress } from '@/types/user';

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

const visible = computed(() =>
  discoverTherapists(therapists.value, query.value, specialty.value, {
    address: myAddress.value,
    nearbyOnly: nearbyOnly.value,
  }),
);

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
  padding: calc(env(safe-area-inset-top) + 4px) 16px 10px;
  background-image: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.22),
    rgba(247, 250, 249, 0.38) 55%,
    rgba(247, 250, 249, 0.62)
  );
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
  padding: 8px 13px;
  border-radius: var(--cc-radius-pill);
  border: 1px solid var(--cc-line);
  background: var(--cc-surface-0);
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--cc-ink-600);
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
.cc-discover__count {
  margin: 0;
}
.cc-discover__card {
  display: flex;
  flex-direction: column;
  gap: 11px;
}
/* Fully booked stays visible, per the design, but reads as unavailable. */
.cc-discover__card--booked {
  opacity: 0.72;
}
.cc-discover__top {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.cc-discover__id {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cc-discover__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 2px;
  font-family: var(--cc-font-interface);
  font-size: 12px;
  color: var(--cc-ink-600);
}
.cc-discover__rating {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.cc-discover__location {
  min-width: 0;
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
  padding: 5px 10px;
  border-radius: var(--cc-radius-pill);
  background: var(--cc-color-mist);
  font-family: var(--cc-font-interface);
  font-size: 12px;
  font-weight: 600;
  color: var(--cc-color-primary);
}
.cc-discover__slot--none {
  background: var(--cc-surface-app);
  color: var(--cc-ink-500);
}
</style>
