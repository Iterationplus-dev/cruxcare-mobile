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
        <AppButton
          v-else
          :loading="requesting"
          :disabled="!!standingRequest"
          @click="requestTherapist"
        >
          {{ standingRequest ? 'Request already sent' : 'Request therapist' }}
        </AppButton>
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
const { data: therapist, isPending } = useTherapist(therapistId);
const queryClient = useQueryClient();
const requesting = ref(false);

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

    const message =
      error instanceof ApiError
        ? error.message
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
