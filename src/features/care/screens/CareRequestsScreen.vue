<template>
  <ion-page>
    <AppHeader title="Your requests" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['care', 'requests']]" />
      <LoadingState v-if="isPending" label="Loading your requests…" />
      <div v-else class="cc-screen__pad">
        <EmptyState
          v-if="!requests.length"
          icon="assignment"
          title="No requests yet"
          message="When you ask for a therapist, the request and its progress show up here."
          primary-action="Find a therapist"
          @primary="router.push({ name: 'care-hub' })"
        />

        <AppCard v-for="request in requests" :key="request.id" class="cc-request">
          <div class="cc-request__head">
            <AppAvatar
              v-if="request.therapistName"
              :name="request.therapistName"
              :src="request.therapistAvatarUrl ?? undefined"
              :size="44"
            />
            <span v-else class="cc-request__open-icon">
              <AppIcon name="groups" :size="22" color="var(--cc-color-primary)" />
            </span>
            <div class="cc-request__head-body">
              <div class="cc-text-body-strong" style="font-size: 15px">
                {{ request.therapistName ?? 'Open request' }}
              </div>
              <div class="cc-text-caption">Sent {{ formatRelativeTime(request.createdAt) }}</div>
            </div>
            <AppBadge :label="present(request).label" :tone="present(request).tone" />
          </div>

          <p class="cc-request__summary">{{ present(request).summary }}</p>

          <div class="cc-request__reason">
            <div class="cc-text-caption cc-request__label">WHAT YOU ASKED FOR</div>
            <p>{{ request.reason }}</p>
          </div>

          <!-- Server-recorded steps only: an empty timeline stays empty rather
               than implying progress the API has not reported. -->
          <ol v-if="request.events.length" class="cc-timeline">
            <li v-for="(event, index) in request.events" :key="event.id" class="cc-timeline__step">
              <span
                class="cc-timeline__marker"
                :class="{ 'cc-timeline__marker--latest': index === request.events.length - 1 }"
              />
              <div class="cc-timeline__body">
                <div class="cc-text-body-strong" style="font-size: 13.5px">{{ event.label }}</div>
                <div v-if="event.note" class="cc-text-caption">{{ event.note }}</div>
                <div class="cc-text-caption">{{ formatRelativeTime(event.at) }}</div>
              </div>
            </li>
          </ol>

          <div class="cc-request__footer">
            <span class="cc-text-mono cc-request__reference">{{ request.reference }}</span>
            <AppButton
              v-if="canCancelCareRequest(request.status)"
              variant="text"
              :full-width="false"
              :loading="cancelling === request.id"
              @click="onCancel(request)"
            >
              Withdraw
            </AppButton>
          </div>
        </AppCard>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import {
  AppAvatar,
  AppBadge,
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppPullToRefresh,
} from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { therapistsApi } from '@/api/therapists.api';
import { useCareRequests } from '@/composables/useCareRequests';
import { useToast } from '@/composables/useToast';
import { canCancelCareRequest, presentCareRequest } from '@/features/care/careRequestPresentation';
import { formatRelativeTime } from '@/utils/formatTime';
import { ApiError } from '@/types/api';
import type { CareRequest } from '@/types/care';

/**
 * Where a client follows a therapist request after sending it. Assignment is
 * a staff workflow, so this screen reports what the server has recorded and
 * never predicts an outcome.
 */
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();
const { data: page, isPending } = useCareRequests();
const requests = computed(() => page.value?.data ?? []);
const cancelling = ref<string | null>(null);

const present = (request: CareRequest) => presentCareRequest(request.status);

async function onCancel(request: CareRequest) {
  cancelling.value = request.id;
  try {
    await therapistsApi.cancelRequest(request.id);
    await queryClient.invalidateQueries({ queryKey: ['care', 'requests'] });
    await toast.show('That request has been withdrawn.', 'success', { title: 'Request withdrawn' });
  } catch (error) {
    // `request_not_cancellable` means the request moved on while this screen
    // was open — the server's status is the truth, so refetch instead of
    // leaving a Withdraw button on a request that no longer accepts one.
    if (error instanceof ApiError && error.code === 'request_not_cancellable') {
      await queryClient.invalidateQueries({ queryKey: ['care', 'requests'] });
      await toast.show(error.message, 'warning', { title: 'Request already moved on' });
      return;
    }

    const message =
      error instanceof ApiError
        ? error
        : 'We could not withdraw that request. Please try again.';
    await toast.show(message, 'danger', { title: 'Could not withdraw', dismissLabel: 'Try again' });
  } finally {
    cancelling.value = null;
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
.cc-request__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.cc-request__head-body {
  flex: 1;
  min-width: 0;
}
.cc-request__open-icon {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: var(--cc-radius-pill);
  background: var(--cc-color-mist);
  display: grid;
  place-items: center;
}
.cc-request__summary {
  margin: 0 0 12px;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 18px;
  color: var(--cc-ink-600);
}
.cc-request__reason {
  padding: 10px 12px;
  border-radius: var(--cc-radius-md);
  background: var(--cc-surface-app);
}
.cc-request__label {
  color: var(--cc-ink-400);
  letter-spacing: 0.04em;
}
.cc-request__reason p {
  margin: 2px 0 0;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 18px;
  color: var(--cc-ink-900);
}
.cc-timeline {
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
}
.cc-timeline__step {
  position: relative;
  display: flex;
  gap: 12px;
  padding: 0 0 14px 2px;
}
/* Connector runs between markers, so the last step does not trail a line. */
.cc-timeline__step:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 14px;
  bottom: 0;
  width: 1px;
  background: var(--cc-line);
}
.cc-timeline__step:last-child {
  padding-bottom: 0;
}
.cc-timeline__marker {
  position: relative;
  flex-shrink: 0;
  width: 11px;
  height: 11px;
  margin-top: 5px;
  border-radius: var(--cc-radius-pill);
  background: var(--cc-line);
}
.cc-timeline__marker--latest {
  background: var(--cc-color-primary);
}
.cc-timeline__body {
  min-width: 0;
}
.cc-request__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--cc-divider);
}
.cc-request__reference {
  font-size: 11.5px;
  color: var(--cc-ink-400);
}
</style>
