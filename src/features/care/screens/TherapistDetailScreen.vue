<template>
  <ion-page>
    <AppHeader title="Therapist profile" show-back back-href="/tabs/care" />
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['therapists']]" />
      <LoadingState v-if="isPending" label="Loading therapist profile…" />

      <div v-else-if="therapist" class="cc-screen__pad">
        <AppCard class="cc-therapist-detail__summary">
          <AppAvatar :name="therapist.name" :src="therapist.avatarUrl ?? undefined" :size="64" />
          <div class="cc-therapist-detail__identity">
            <h2 class="cc-text-h2" style="margin: 0">{{ therapist.name }}</h2>
            <!-- Always shown. It used to render only when a rating existed,
                 and none ever does — nothing on the platform collects one — so
                 the row a client came here to read was permanently invisible.
                 An unrated therapist says so rather than disappearing. -->
            <div class="cc-therapist-detail__rating" :aria-label="ratingLabel(therapist)">
              <AppIcon
                name="star"
                :size="18"
                filled
                :color="therapist.rating === null ? 'var(--cc-ink-300)' : 'var(--cc-color-warning)'"
              />
              <span>{{ ratingText(therapist) }}</span>
            </div>
            <div class="cc-therapist-detail__location">
              <AppIcon name="location_on" :size="17" color="var(--cc-ink-600)" />
              <span>{{ therapist.location ?? 'Online consultation' }}</span>
            </div>
          </div>
        </AppCard>

        <section class="cc-therapist-detail__section" aria-labelledby="about-heading">
          <h3 id="about-heading" class="cc-text-body-strong cc-therapist-detail__heading">About</h3>
          <AppCard>
            <p class="cc-text-body cc-therapist-detail__bio">
              {{ therapist.bio ?? 'Available for thoughtful, client-centred care tailored to your wellness needs.' }}
            </p>
          </AppCard>
        </section>

        <section class="cc-therapist-detail__section" aria-labelledby="specialties-heading">
          <h3 id="specialties-heading" class="cc-text-body-strong cc-therapist-detail__heading">Areas of specialization</h3>
          <AppCard>
            <div class="cc-therapist-detail__chips">
              <span v-for="specialty in therapist.specialties" :key="specialty" class="cc-therapist-detail__chip">{{ specialty }}</span>
            </div>
          </AppCard>
        </section>

        <AppCard style="padding: 0">
          <AppListRow
            title="Experience"
            :subtitle="therapist.experienceYears ? `${therapist.experienceYears} years in practice` : 'Experience details available on request'"
            icon="workspace_premium"
          />
          <AppListRow
            title="Languages"
            :subtitle="languagesLine"
            icon="translate"
            :divider="false"
          />
        </AppCard>
      </div>

      <!-- The server refuses this profile while the client is with someone
           else, and says so with a 403 rather than pretending the therapist
           does not exist. Saying "not found" about somebody they saw last week
           would be a lie the screen then has to explain badly. -->
      <EmptyState
        v-else-if="blockedBy"
        icon="lock"
        title="Not while your care is open"
        :message="`You are with ${blockedBy.therapistName ?? 'another therapist'}. Finish or end that course of care and you can see other therapists again.`"
        primary-action="Go to your care"
        @primary="router.replace({ name: 'care-mine' })"
      />

      <EmptyState
        v-else
        title="Therapist not found"
        message="This therapist profile is no longer available."
        primary-action="Back to Care"
        @primary="router.replace({ name: 'care-hub' })"
      />

      <div v-if="therapist" class="cc-screen__footer">
        <!-- A second request would land in the therapist's queue as a duplicate
             of one they are already deciding on, so the state is stated rather
             than the tap being silently refused. -->
        <p v-if="standingRequest" class="cc-text-caption cc-therapist-detail__standing">
          {{ standingRequestMessage }}
        </p>
        <!-- Once the therapist has accepted, the useful action is booking, not
             asking again. Before that, booking would be rejected server-side
             for want of an accepted request, so it is not offered. -->
        <AppButton v-if="isAccepted" @click="bookVisit">Book a visit</AppButton>
        <template v-else>
          <!-- A client holds one therapist at a time. Saying who they are with
               beats a button that only fails when tapped — and the way out is
               to end that care, so this points at it. -->
          <div v-if="heldElsewhere" class="cc-td__held">
            <AppIcon name="info" :size="18" color="var(--cc-color-warning-text)" />
            <p>
              You are already with <strong>{{ heldElsewhere.therapistName }}</strong>. End that
              care first and you can ask {{ therapist.name }} instead.
            </p>
          </div>
          <AppButton
            v-if="heldElsewhere"
            variant="secondary"
            @click="router.push({ name: 'care-mine' })"
          >
            Go to your care
          </AppButton>
          <AppButton
            v-else
            :loading="requesting"
            :disabled="!!standingRequest"
            @click="requestTherapist"
          >
            {{ standingRequest ? 'Request already sent' : 'Request therapist' }}
          </AppButton>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { AppPullToRefresh } from '@/components/ui';
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppAvatar, AppButton, AppCard, AppHeader, AppIcon, AppListRow } from '@/components/ui';
import { assignedElsewhere, blockedWhileEngaged } from '@/features/care/engagement';
import { useCareEngagement } from '@/composables/useTherapists';
import { EmptyState, LoadingState } from '@/components/state';
import { therapistsApi } from '@/api/therapists.api';
import { ratingLabel, ratingText } from '@/features/care/therapistRating';
import { useTherapist } from '@/composables/useTherapists';
import { useToast } from '@/composables/useToast';
import { useQueryClient } from '@tanstack/vue-query';
import { useAuthStore } from '@/stores/auth';
import { ApiError } from '@/types/api';
import { useCareRequests, CARE_REQUESTS_KEY } from '@/composables/useCareRequests';
import { findStandingRequestTo } from '@/features/care/careRequestPresentation';
import { fullName as formatFullName } from '@/types/user';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();
const clientName = computed(() => (auth.user ? formatFullName(auth.user) : 'A client'));
const therapistId = computed(() => String(route.params.id ?? ''));
const { data: therapist, isPending, error: loadError } = useTherapist(therapistId);
const queryClient = useQueryClient();
const requesting = ref(false);
const { data: engagementState } = useCareEngagement();

/** Set when the profile itself was refused because of an open course of care,
 *  which is a different thing from the therapist not existing. */
const blockedBy = computed(() => blockedWhileEngaged(loadError.value));

/**
 * An empty `languages` array is not a missing one: `[].join(', ')` is `''`, so
 * `??` never fired and the row rendered a title with nothing under it. Every
 * therapist on the directory today has an empty array, so that blank line was
 * the only thing anyone saw.
 */
const languagesLine = computed(() =>
  therapist.value?.languages?.length
    ? therapist.value.languages.join(', ')
    : 'Language details available on request',
);

/** The client's own requests, so a therapist they have already asked cannot be
 *  asked twice. The server is the enforcer; this stops the trip. */
const { data: myRequests } = useCareRequests();
const standingRequest = computed(() =>
  findStandingRequestTo(myRequests.value?.data, therapistId.value),
);
const isAccepted = computed(() => standingRequest.value?.status === 'accepted');

function bookVisit() {
  router.push({ name: 'book-appointment', query: { therapistId: therapistId.value } });
}

const standingRequestMessage = computed(() =>
  standingRequest.value?.status === 'accepted'
    ? 'You are already working with this therapist.'
    : 'You have already asked this therapist. They will respond to your first request.',
);

/**
 * Who the client is tied to, when that is someone other than this therapist.
 * The server refuses either way; this is what lets the screen say so first.
 */
const heldElsewhere = computed(() => {
  const held = engagementState.value?.engagement;
  if (!held || held.therapistId === therapist.value?.id) return null;
  return held;
});

async function requestTherapist() {
  if (!therapist.value) return;
  const target = therapist.value;
  requesting.value = true;
  try {
    await therapistsApi.requestAssignment(
      `${clientName.value} would like to work with ${target.name}.`,
      target.id,
    );
    await toast.show(`${target.name} has been notified of your request.`, 'success', {
      title: 'Request sent',
    });
    router.replace({ name: 'care-hub' });
  } catch (error) {
    // The server refuses a second ask at a therapist who has not answered the
    // first, and sends the standing one back. Say which request already exists
    // rather than only refusing, and refresh so the button settles into its
    // disabled state instead of inviting another tap.
    if (error instanceof ApiError && error.code === 'duplicate_request') {
      const reference = typeof error.meta?.reference === 'string' ? error.meta.reference : null;
      await queryClient.invalidateQueries({ queryKey: CARE_REQUESTS_KEY });
      await toast.show(
        reference ? `${error.message} Your request is ${reference}.` : error.message,
        'warning',
        { title: 'Already requested' },
      );
      return;
    }

    // "Already with someone else" is a different refusal from "you already
    // asked this person", and the way out of it is to end the other care.
    const elsewhere = assignedElsewhere(error);
    if (elsewhere) {
      await queryClient.invalidateQueries({ queryKey: ['care-engagement'] });
      await toast.show(
        elsewhere.therapistName
          ? `You are already with ${elsewhere.therapistName}. End that care first.`
          : error instanceof ApiError
            ? error.message
            : 'You are already with another therapist.',
        'warning',
        { title: 'Already with a therapist' },
      );
      return;
    }

    const message =
      error instanceof ApiError
        ? error
        : `We could not send your request to ${target.name}. Please try again.`;
    await toast.show(message, 'danger', {
      title: 'Could not send request',
      dismissLabel: 'Try again',
    });
  } finally {
    requesting.value = false;
  }
}
</script>

<style scoped>
.cc-td__held {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 11px 13px;
  border-radius: var(--cc-radius-md);
  background: var(--cc-color-warning-tint);
}
.cc-td__held p {
  margin: 0;
  color: var(--cc-color-warning-text);
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 18px;
}

.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 16px 16px 108px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.cc-screen__footer {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2;
  padding: 12px 16px calc(env(safe-area-inset-bottom) + 12px);
  border-top: 1px solid var(--cc-line);
  background: var(--cc-surface-0);
}
.cc-therapist-detail__summary {
  display: flex;
  gap: 14px;
  align-items: center;
}
.cc-therapist-detail__identity {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cc-therapist-detail__standing {
  margin: 0 0 8px;
  text-align: center;
}
.cc-therapist-detail__rating,
.cc-therapist-detail__location {
  display: flex;
  align-items: center;
  gap: 5px;
  color: var(--cc-ink-600);
  font-size: 13.5px;
  line-height: 20px;
}
.cc-therapist-detail__rating {
  color: var(--cc-ink-900);
  font-weight: 600;
}
.cc-therapist-detail__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cc-therapist-detail__heading {
  margin: 0;
  font-size: 16px;
}
.cc-therapist-detail__bio {
  margin: 0;
  color: var(--cc-ink-600);
}
.cc-therapist-detail__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cc-therapist-detail__chip {
  border-radius: var(--cc-radius-pill);
  padding: 7px 11px;
  background: var(--cc-color-mist);
  color: var(--cc-color-primary-dark);
  font-size: 13px;
  font-weight: 600;
}
</style>
