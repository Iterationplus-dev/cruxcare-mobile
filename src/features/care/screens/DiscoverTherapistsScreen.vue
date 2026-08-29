<template>
  <ion-page>
    <div class="cc-discover__header">
      <h1 class="cc-text-h1" style="margin: 0">Discover therapists</h1>
    </div>
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['therapists'], ['case-files'], ['care', 'requests']]" />
      <LoadingState v-if="isPending" label="Loading therapists…" />

      <EmptyState
        v-else-if="!therapists?.length"
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

        <p class="cc-text-caption cc-discover__count">
          {{ visible.length }} {{ visible.length === 1 ? 'therapist' : 'therapists' }}
          <span v-if="nearbyOnly && myPlace">near {{ myPlace }}</span>
        </p>

        <EmptyState
          v-if="!visible.length"
          icon="search_off"
          :title="nearbyOnly ? 'None near you' : 'No match'"
          :message="nearbyOnly
            ? `No therapist here is listed in ${myPlace ?? 'your area'}. Turn off Near me to see everyone.`
            : 'No therapist here matches what you searched for.'"
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
            <span v-else class="cc-discover__slot cc-discover__slot--none">
              {{ t.fullyBooked ? 'Fully booked' : 'No slots listed' }}
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
import { computed, ref } from 'vue';
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
import { useTherapists } from '@/composables/useTherapists';
import { useCaseFiles } from '@/composables/useCaseFiles';
import { useCareRequests } from '@/composables/useCareRequests';
import {
  discoverTherapists,
  formatNextSlot,
  isNearby,
  specialtyChips,
} from '@/features/care/discoverTherapists';
import { useAuthStore } from '@/stores/auth';
import { formatAddress } from '@/types/user';

/** CD2 · Discover therapists — the Care tab's own screen. */
const router = useRouter();
const { data: page, isPending } = useTherapists();
const therapists = computed(() => page.value?.data);

const query = ref('');
const specialty = ref<string | null>(null);
const chips = computed(() => specialtyChips(therapists.value));
const nearbyOnly = ref(false);

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
