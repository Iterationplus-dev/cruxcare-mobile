<template>
  <ion-page>
    <AppHeader title="Therapist profile" show-back back-href="/tabs/care" />
    <ion-content class="cc-screen">
      <LoadingState v-if="isPending" label="Loading therapist profile…" />

      <div v-else-if="therapist" class="cc-screen__pad">
        <AppCard class="cc-therapist-detail__summary">
          <AppAvatar :name="therapist.name" :size="64" />
          <div class="cc-therapist-detail__identity">
            <h2 class="cc-text-h2" style="margin: 0">{{ therapist.name }}</h2>
            <div
              v-if="therapist.rating !== null"
              class="cc-therapist-detail__rating"
              :aria-label="`${therapist.rating.toFixed(1)} out of 5 rating`"
            >
              <AppIcon name="star" :size="18" filled color="var(--cc-color-warning)" />
              <span>{{ therapist.rating.toFixed(1) }} rating</span>
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
            :subtitle="therapist.languages?.join(', ') ?? 'Language details available on request'"
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
        <AppButton :loading="requesting" @click="requestTherapist">Request therapist</AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppAvatar, AppButton, AppCard, AppHeader, AppIcon, AppListRow } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { therapistsApi } from '@/api/therapists.api';
import { useTherapist } from '@/composables/useTherapists';
import { useToast } from '@/composables/useToast';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const therapistId = computed(() => String(route.params.id ?? ''));
const { data: therapist, isPending } = useTherapist(therapistId);
const requesting = ref(false);

async function requestTherapist() {
  if (!therapist.value) return;
  requesting.value = true;
  try {
    await therapistsApi.requestAssignment(`Requested therapist ${therapist.value.id}`);
    await toast.show('Request sent — CruxCare will confirm your assignment.', 'success');
    router.replace({ name: 'care-hub' });
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
