<template>
  <ion-page>
    <div class="cc-care__header">
      <h1 class="cc-text-h1" style="margin: 0">Care</h1>
    </div>
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['case-files'], ['therapists'], ['appointments'], ['chat', 'threads']]" />
      <LoadingState v-if="isPending" label="Loading your care…" />
      <div v-else class="cc-screen__pad">
        <template v-if="therapist">
          <AppCard>
            <div class="cc-care__therapist">
              <AppAvatar :name="therapist.name" :src="therapist.avatarUrl ?? undefined" :size="56" />
              <div class="cc-care__therapist-body">
                <div class="cc-text-body-strong" style="font-size: 16px">{{ therapist.name }}</div>
                <div class="cc-text-caption">Your therapist · {{ therapist.specialties.join(', ') }}</div>
              </div>
            </div>
            <div class="cc-care__actions">
              <AppButton @click="goChat">Message</AppButton>
              <AppButton
                variant="secondary"
                @click="router.push({ name: 'book-appointment', query: { therapistId: therapist.id } })"
              >
                Book
              </AppButton>
              <button type="button" class="cc-care__video-btn" aria-label="Start video visit" @click="goVideo">
                <AppIcon name="videocam" :size="20" color="var(--cc-ink-600)" />
              </button>
            </div>
          </AppCard>

          <AppCard v-if="headline" class="cc-care__next-visit" :class="{ 'cc-care__next-visit--late': headline.timing === 'overdue' }">
            <div class="cc-text-caption" style="color: #9bd2c8">
              {{ headline.timing === 'overdue' ? 'MISSED VISIT' : 'NEXT VISIT' }}
            </div>
            <div class="cc-text-h2" style="color: #fff; margin: 4px 0">{{ formatSlot(headline.appointment.slot) }}</div>
            <div style="color: #cde7e1; font-size: 13.5px">
              {{ headline.appointment.type }} visit<template v-if="overdueFor"> · {{ overdueFor }}</template>
            </div>
            <AppButton
              v-if="canRescheduleHeadline"
              variant="secondary"
              class="cc-care__rebook"
              @click="rescheduleHeadline"
            >
              {{ headline.timing === 'overdue' ? 'Rebook this visit' : 'Reschedule' }}
            </AppButton>
          </AppCard>

          <div class="cc-text-body-strong" style="font-size: 16px">Your care</div>
          <AppCard style="padding: 0">
            <AppListRow
              title="Health profile"
              :subtitle="healthGapSubtitle"
              icon="medical_information"
              chevron
              clickable
              @click="router.push({ name: 'health-profile' })"
            />
            <AppListRow
              v-if="careRequests.length"
              title="Your requests"
              :subtitle="requestsSubtitle"
              icon="assignment"
              chevron
              clickable
              :divider="false"
              @click="router.push({ name: 'care-requests' })"
            />
          </AppCard>

          <template v-if="caseFile?.recommendations.length">
            <div class="cc-text-body-strong" style="font-size: 16px">Recommended by your therapist</div>
            <AppCard v-for="r in caseFile.recommendations" :key="r.id" class="cc-care__reco">
              <div class="cc-care__reco-body">
                <div class="cc-text-body-strong" style="font-size: 14.5px">{{ r.productName }}</div>
                <div class="cc-text-caption">{{ r.note }}</div>
              </div>
              <AppButton variant="secondary" @click="router.push({ name: 'product-detail', params: { id: r.productId } })">
                Add
              </AppButton>
            </AppCard>
          </template>
        </template>

        <template v-else>
          <AppCard v-if="careRequests.length" style="padding: 0">
            <AppListRow
              title="Your requests"
              :subtitle="requestsSubtitle"
              icon="assignment"
              chevron
              clickable
              :divider="false"
              @click="router.push({ name: 'care-requests' })"
            />
          </AppCard>

          <EmptyState
            icon="health_and_safety"
            title="No therapist assigned yet"
            :message="therapists.length
              ? 'Choose a therapist below or wait to be assigned by CruxCare.'
              : 'No therapist is available to show right now. Request a match and CruxCare will contact you.'"
            :primary-action="therapists.length ? undefined : 'Request a therapist'"
            @primary="requestMatching"
          />
          <div v-if="therapists.length" class="cc-care__search">
            <AppIcon name="search" :size="20" color="var(--cc-ink-400)" />
            <input
              v-model="therapistSearch"
              type="search"
              placeholder="Search therapists by name"
              aria-label="Search therapists by name"
            />
            <button
              v-if="therapistSearch"
              type="button"
              class="cc-care__search-clear"
              aria-label="Clear search"
              @click="therapistSearch = ''"
            >
              <AppIcon name="close" :size="18" color="var(--cc-ink-400)" />
            </button>
          </div>

          <p v-if="therapistSearch.trim() && !filteredTherapists.length" class="cc-care__no-match cc-text-caption">
            No therapist here matches “{{ therapistSearch.trim() }}”.
          </p>

          <AppCard v-for="t in filteredTherapists" :key="t.id" class="cc-care__discover">
            <div class="cc-care__discover-profile">
              <AppAvatar :name="t.name" :src="t.avatarUrl ?? undefined" :size="46" />
              <div
                class="cc-care__discover-rating"
                :class="{ 'cc-care__discover-rating--unrated': t.rating === null }"
                :aria-label="t.rating === null ? 'Not rated yet' : `${t.rating.toFixed(1)} out of 5 rating`"
              >
                <AppIcon
                  name="star"
                  :size="16"
                  filled
                  :color="t.rating === null ? 'var(--cc-ink-300)' : 'var(--cc-color-warning)'"
                />
                <span>{{ t.rating === null ? 'New' : t.rating.toFixed(1) }}</span>
              </div>
            </div>
            <div class="cc-care__discover-body">
              <div class="cc-text-body-strong cc-care__discover-name">{{ t.name }}</div>
              <div class="cc-text-caption cc-care__discover-specialties">{{ t.specialties.join(', ') }}</div>
              <div class="cc-care__discover-location">
                <AppIcon name="location_on" :size="16" color="var(--cc-ink-600)" />
                <span>{{ t.location ?? 'Online consultation' }}</span>
              </div>
              <div class="cc-care__discover-actions">
                <AppButton variant="secondary" @click="router.push({ name: 'therapist-detail', params: { id: t.id } })">
                  View profile
                </AppButton>
                <AppButton @click="requestTherapist(t)">Request</AppButton>
              </div>
            </div>
          </AppCard>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { AppPullToRefresh } from '@/components/ui';
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppIcon,
  AppListRow,
} from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import {
  canJoin,
  canReschedule,
  headlineAppointment,
  howLongAgo,
} from '@/features/care/appointmentState';
import { useAppointments } from '@/composables/useAppointments';
import { useCaseFiles } from '@/composables/useCaseFiles';
import { useTherapist, useTherapists } from '@/composables/useTherapists';
import { useCareRequests } from '@/composables/useCareRequests';
import { presentCareRequest } from '@/features/care/careRequestPresentation';
import { therapistsApi } from '@/api/therapists.api';
import { findThreadWith, useChatThreads } from '@/composables/useChat';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { useQueryClient } from '@tanstack/vue-query';
import { fullName as formatFullName } from '@/types/user';
import type { TherapistSummary } from '@/types/care';

const router = useRouter();
const auth = useAuthStore();
const toast = useToast();
const queryClient = useQueryClient();
const clientName = computed(() => (auth.user ? formatFullName(auth.user) : 'A client'));
const { data: chatThreads } = useChatThreads();

const { data: caseFilesPage, isPending: caseFilesPending } = useCaseFiles();
const caseFile = computed(() =>
  caseFilesPage.value?.data.find((cf) => cf.clientId === auth.user?.id),
);
const { data: therapist, isPending: therapistPending } = useTherapist(
  computed(() => caseFile.value?.therapistId ?? ''),
);
const { data: therapistsPage, isPending: therapistsPending } = useTherapists();
const therapists = computed(() => therapistsPage.value?.data ?? []);

/**
 * Filtered on the client: GET /therapists takes only `cursor`, so there is no
 * server-side name query to delegate to. That scopes the search to the
 * directory page already loaded — fine at the current page size (20), but it
 * needs a backend `search` param before the directory outgrows one page.
 */
const therapistSearch = ref('');
const filteredTherapists = computed(() => {
  const term = therapistSearch.value.trim().toLowerCase();
  if (!term) return therapists.value;
  return therapists.value.filter((t) => t.name.toLowerCase().includes(term));
});

const { data: careRequestsPage } = useCareRequests();
const careRequests = computed(() => careRequestsPage.value?.data ?? []);
const openRequestCount = computed(
  () => careRequests.value.filter((r) => presentCareRequest(r.status).open).length,
);
const requestsSubtitle = computed(() =>
  openRequestCount.value
    ? `${openRequestCount.value} in progress · track status`
    : 'Track the status of requests you have sent',
);

const { data: appointmentsPage } = useAppointments();

/**
 * Same correction as Home: `find(a => a.status === 'confirmed')` had no notion
 * of time in it, so a visit that had already happened sat under NEXT VISIT.
 */
const headline = computed(() => headlineAppointment(appointmentsPage.value?.data));
const canRescheduleHeadline = computed(
  () => !!headline.value && canReschedule(headline.value.appointment),
);
const overdueFor = computed(() =>
  headline.value?.timing === 'overdue' ? howLongAgo(headline.value.appointment.slot) : null,
);

function rescheduleHeadline() {
  if (!headline.value) return;
  const { appointment } = headline.value;
  router.push({
    name: 'book-appointment',
    query: { therapistId: appointment.therapistId, rescheduleId: appointment.id },
  });
}

const isPending = computed(
  () => caseFilesPending.value || (!!caseFile.value && therapistPending.value) || therapistsPending.value,
);

const healthGapSubtitle = 'Keep it current so your therapist has full context';

function formatSlot(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function goChat() {
  const thread = findThreadWith(chatThreads.value, caseFile.value?.therapistId);
  if (thread) router.push({ name: 'chat-thread', params: { id: thread.id } });
  else router.push({ name: 'chat-inbox' });
}
function goVideo() {
  // Only a confirmed visit still to come has a call behind it.
  if (headline.value && canJoin(headline.value.appointment, headline.value.timing)) {
    router.push({ name: 'video-visit', params: { id: headline.value.appointment.id } });
    return;
  }
  toast.show('There is no session to join right now.', 'info');
}

async function requestMatching(reason = 'Please match me with an available therapist.') {
  try {
    await therapistsApi.requestAssignment(reason);
    await showRequestTracking();
    await toast.show('Your request is on its way. CruxCare will contact you when a therapist is available.', 'success', {
      title: 'Matching request sent',
    });
  } catch {
    await toast.show('We could not send your matching request. Please try again.', 'danger', {
      title: 'Could not request a therapist',
      dismissLabel: 'Try again',
    });
  }
}

/**
 * A sent request is only useful if the client can follow it, so both request
 * paths land on the tracking screen with the new row already refetched.
 */
async function showRequestTracking() {
  await queryClient.invalidateQueries({ queryKey: ['care', 'requests'] });
  await router.push({ name: 'care-requests' });
}

/** Named request: the therapist is attached to the case and notified. */
async function requestTherapist(therapist: TherapistSummary) {
  try {
    await therapistsApi.requestAssignment(
      `${clientName.value} would like to work with ${therapist.name}.`,
      therapist.id,
    );
    await showRequestTracking();
    await toast.show(`${therapist.name} has been notified of your request.`, 'success', {
      title: 'Request sent',
    });
  } catch {
    await toast.show(`We could not send your request to ${therapist.name}. Please try again.`, 'danger', {
      title: 'Could not send request',
      dismissLabel: 'Try again',
    });
  }
}
</script>

<style scoped>
.cc-care__next-visit--late {
  background: var(--cc-color-warning-text);
}
.cc-care__rebook {
  margin-top: 12px;
}
.cc-care__header {
  padding: calc(env(safe-area-inset-top) + 4px) 16px 14px;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(247, 250, 249, 0.38) 55%, rgba(247, 250, 249, 0.62));
}
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 0 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cc-care__therapist {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 14px;
}
.cc-care__therapist-body {
  flex: 1;
}
.cc-care__actions {
  display: flex;
  gap: 8px;
}
.cc-care__actions :deep(.cc-btn) {
  height: 44px;
  font-size: 13.5px;
}
.cc-care__video-btn {
  width: 44px;
  height: 44px;
  border: 1.5px solid var(--cc-line);
  border-radius: var(--cc-radius-md);
  background: var(--cc-surface-0);
  display: grid;
  place-items: center;
  cursor: pointer;
}
.cc-care__next-visit {
  background: var(--cc-color-primary-dark);
  border: none;
}
.cc-care__reco {
  display: flex;
  gap: 12px;
  align-items: center;
}
.cc-care__reco-body {
  flex: 1;
}
.cc-care__search {
  height: 44px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-md);
  background: var(--cc-surface-0);
}
.cc-care__search input {
  flex: 1;
  min-width: 0;
  border: none;
  background: none;
  outline: none;
  font-family: var(--cc-font-interface);
  font-size: 13.5px;
}
.cc-care__search-clear {
  display: flex;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}
.cc-care__no-match {
  margin: 0;
}
.cc-care__discover {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.cc-care__discover-profile {
  align-self: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.cc-care__discover-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
}
.cc-care__discover-name {
  font-size: 16px;
  line-height: 22px;
}
.cc-care__discover-rating,
.cc-care__discover-location {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--cc-ink-600);
  font-size: 13px;
  line-height: 18px;
}
.cc-care__discover-rating {
  color: var(--cc-ink-900);
  font-weight: 600;
}
/* No reviews yet — present but visibly quieter than a real score. */
.cc-care__discover-rating--unrated {
  color: var(--cc-ink-400);
  font-weight: 500;
}
.cc-care__discover-specialties {
  min-height: 19px;
  line-height: 19px;
}
.cc-care__discover-location {
  margin-bottom: 4px;
}
.cc-care__discover-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
