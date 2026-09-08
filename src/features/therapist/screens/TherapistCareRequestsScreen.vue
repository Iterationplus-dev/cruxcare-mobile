<template>
  <ion-page>
    <AppHeader title="Client requests" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[therapistCareRequestsKey]" />
      <LoadingState v-if="isPending" label="Loading client requests…" />
      <div v-else class="cc-screen__pad">
        <!-- Above the list, not per card: the plan is what blocks every accept
             on the screen, so saying it once is enough. -->
        <AppCard v-if="auth.needsTherapistPlan" class="cc-cq__gate" @click="goPlan">
          <AppIcon name="workspace_premium" :size="20" color="var(--cc-color-primary)" />
          <div class="cc-cq__gate-body">
            <div class="cc-text-body-strong" style="font-size: 13.5px">Choose a plan to take clients</div>
            <div class="cc-text-caption">Requests stay here until your plan is active</div>
          </div>
          <span class="cc-text-body-strong" style="font-size: 12.5px; color: var(--cc-color-primary)">
            Choose
          </span>
        </AppCard>

        <EmptyState
          v-if="!requests.length"
          icon="assignment_ind"
          title="No client requests"
          message="When someone asks to work with you, their request shows up here before anything else."
        />

        <AppCard v-for="request in requests" :key="request.id" class="cc-cq">
          <div class="cc-cq__head">
            <AppAvatar
              :name="request.clientName"
              :src="request.clientAvatarUrl ?? undefined"
              :size="44"
            />
            <div class="cc-cq__head-body">
              <div class="cc-text-body-strong" style="font-size: 15px">{{ request.clientName }}</div>
              <div class="cc-text-caption">Sent {{ formatRelativeTime(request.createdAt) }}</div>
            </div>
            <AppBadge :label="present(request).label" :tone="present(request).tone" />
          </div>

          <p class="cc-cq__summary">{{ present(request).summary }}</p>

          <div class="cc-cq__reason">
            <div class="cc-text-caption cc-cq__label">WHAT THEY ASKED FOR</div>
            <p>{{ request.reason }}</p>
          </div>

          <!-- Only once there is history worth reading: a request that has just
               arrived carries a single step, and listing it adds nothing. -->
          <ol v-if="request.events.length > 1" class="cc-timeline">
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

          <template v-if="canRespondToRequest(request.status)">
            <div class="cc-cq__actions">
              <AppButton
                :loading="pending === acceptKey(request)"
                :disabled="auth.needsTherapistPlan || !!pending"
                @click="respond(request, 'accept')"
              >
                Accept
              </AppButton>
              <AppButton
                variant="secondary"
                :loading="pending === declineKey(request)"
                :disabled="!!pending"
                @click="respond(request, 'decline')"
              >
                Decline
              </AppButton>
            </div>
            <p class="cc-text-caption cc-cq__note">
              Declining tells the client straight away, so CruxCare can match them with someone else.
            </p>
          </template>

          <div class="cc-cq__footer">
            <span class="cc-text-mono cc-cq__reference">{{ request.reference }}</span>
            <!-- Routed by the case file's own id, not the client's. The two
                 are different records, and the route resolves a case file. -->
            <AppButton
              v-if="request.caseFileId"
              variant="text"
              :full-width="false"
              @click="router.push({ name: 'case-file', params: { id: request.caseFileId } })"
            >
              Open case file
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
import { careQueueApi } from '@/api/care-queue.api';
import {
  THERAPIST_CARE_REQUESTS_KEY,
  useTherapistCareRequests,
} from '@/composables/useTherapistCareRequests';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/auth';
import {
  canRespondToRequest,
  presentIncomingRequest,
} from '@/features/therapist/careQueuePresentation';
import { formatRelativeTime } from '@/utils/formatTime';
import { ApiError } from '@/types/api';
import type { TherapistCareRequest } from '@/types/care';

/**
 * Where a therapist answers clients who asked for them. This is the only place
 * a care request reaches the therapist — an appointment request is a different
 * record and belongs to the appointments screen.
 */
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();
const queryClient = useQueryClient();
const { data: page, isPending } = useTherapistCareRequests();
const requests = computed(() => page.value?.data ?? []);

/** Pull-to-refresh takes a plain array of keys; the shared constant is readonly. */
const therapistCareRequestsKey = [...THERAPIST_CARE_REQUESTS_KEY];

/**
 * One in-flight decision at a time, keyed `action:id`, so the buttons on every
 * other card lock too. Two accepts racing would each believe a plan slot was
 * free, and the second would fail after the therapist thought it had worked.
 */
const pending = ref<string | null>(null);
const acceptKey = (request: TherapistCareRequest) => `accept:${request.id}`;
const declineKey = (request: TherapistCareRequest) => `decline:${request.id}`;

const present = (request: TherapistCareRequest) => presentIncomingRequest(request.status);

function goPlan() {
  router.push({ name: 'therapist-plan' });
}

async function respond(request: TherapistCareRequest, action: 'accept' | 'decline') {
  if (pending.value) return;
  pending.value = action === 'accept' ? acceptKey(request) : declineKey(request);
  try {
    await (action === 'accept'
      ? careQueueApi.accept(request.id)
      : careQueueApi.decline(request.id));
    await queryClient.invalidateQueries({ queryKey: THERAPIST_CARE_REQUESTS_KEY });
    // Accepting creates the working relationship, so the surfaces built on it
    // are stale from this moment.
    if (action === 'accept') {
      await queryClient.invalidateQueries({ queryKey: ['case-files'] });
      await queryClient.invalidateQueries({ queryKey: ['chat', 'threads'] });
    }
    await toast.show(
      action === 'accept'
        ? `You are now working with ${request.clientName}.`
        : `The request from ${request.clientName} was declined.`,
      'success',
      { title: action === 'accept' ? 'Request accepted' : 'Request declined' },
    );
  } catch (error) {
    // The client may have withdrawn, or staff re-matched, while this screen sat
    // open. The server's status is the truth, so refetch rather than leave
    // buttons on a request that no longer takes an answer.
    if (error instanceof ApiError && error.code === 'request_not_actionable') {
      await queryClient.invalidateQueries({ queryKey: THERAPIST_CARE_REQUESTS_KEY });
      await toast.show(error.message, 'warning', { title: 'Request already moved on' });
      return;
    }
    const message =
      error instanceof ApiError
        ? error
        : 'We could not send your answer. Please try again.';
    await toast.show(message, 'danger', { title: 'Could not respond', dismissLabel: 'Try again' });
  } finally {
    pending.value = null;
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
.cc-cq__gate {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cc-cq__gate-body {
  flex: 1;
  min-width: 0;
}
.cc-cq__head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.cc-cq__head-body {
  flex: 1;
  min-width: 0;
}
.cc-cq__summary {
  margin: 0 0 12px;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 18px;
  color: var(--cc-ink-600);
}
.cc-cq__reason {
  padding: 10px 12px;
  border-radius: var(--cc-radius-md);
  background: var(--cc-surface-app);
}
.cc-cq__label {
  color: var(--cc-ink-400);
  letter-spacing: 0.04em;
}
.cc-cq__reason p {
  margin: 2px 0 0;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 18px;
  color: var(--cc-ink-900);
}
.cc-cq__actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}
.cc-cq__note {
  margin: 8px 0 0;
}
.cc-cq__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--cc-divider);
}
.cc-cq__reference {
  font-size: 11.5px;
  color: var(--cc-ink-400);
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
</style>
