<template>
  <ion-page>
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['appointments'], ['case-files'], ['chat', 'threads'], ['wallet']]" />
      <div class="cc-td__header">
        <AppAvatar :name="fullName" :src="auth.user?.avatarUrl ?? undefined" :size="40" />
        <div class="cc-td__greeting">
          <div class="cc-td__date">{{ formattedDate }}</div>
          <div class="cc-text-h2" style="margin: 0">{{ fullName }}</div>
        </div>
        <AppBadge label="THERAPIST" />
      </div>
      <div class="cc-td__stats">
        <div class="cc-td__stat">
          <div class="cc-td__stat-label">TODAY</div>
          <div class="cc-td__stat-value">{{ todaysAppointments.length }} sessions</div>
        </div>
        <div class="cc-td__stat">
          <div class="cc-td__stat-label">WALLET</div>
          <div class="cc-td__stat-value">
            <MoneyAmount v-if="wallet" :value="wallet.available" :currency="wallet.currency" />
          </div>
        </div>
      </div>

      <div class="cc-td__body">
        <!-- Sits above the loading state: subscribing does not depend on the
             dashboard's data, and it is what unblocks taking clients. -->
        <AppCard v-if="auth.needsTherapistPlan" class="cc-td__plan-banner" @click="goPlan">
          <AppIcon name="workspace_premium" :size="20" color="var(--cc-color-primary)" />
          <div class="cc-td__banner-body">
            <div class="cc-text-body-strong" style="font-size: 13.5px">
              {{ planBannerTitle }}
            </div>
            <div class="cc-text-caption">Clients cannot be assigned to you until a plan is active</div>
          </div>
          <span class="cc-text-body-strong" style="font-size: 12.5px; color: var(--cc-color-primary)">
            Choose
          </span>
        </AppCard>

        <LoadingState v-if="appointmentsQuery.isPending.value" label="Loading your dashboard…" />
        <template v-else>
          <AppCard v-if="pendingRequests.length" tint class="cc-td__banner" @click="goRequests">
            <AppIcon name="pending_actions" :size="20" color="#9A5B15" />
            <div class="cc-td__banner-body">
              <div class="cc-text-body-strong" style="font-size: 13.5px">
                {{ pendingRequests.length }} booking request{{ pendingRequests.length === 1 ? '' : 's' }} waiting
              </div>
              <div class="cc-text-caption">Review to accept or decline</div>
            </div>
            <span class="cc-text-body-strong" style="font-size: 12.5px; color: var(--cc-color-primary)">Review</span>
          </AppCard>

          <div class="cc-home__section-head">
            <span class="cc-text-body-strong" style="font-size: 14.5px">Today's schedule</span>
            <a href="#" class="cc-text-body-strong" style="font-size: 12.5px" @click.prevent="goCalendar">Calendar</a>
          </div>

          <EmptyState
            v-if="!todaysAppointments.length"
            icon="event_available"
            title="No sessions today"
            message="Your accepted appointments for today will show up here."
          />
          <AppCard v-else style="padding: 0">
            <AppListRow
              v-for="a in todaysAppointments"
              :key="a.id"
              :title="a.clientName"
              :subtitle="`${a.type} · ${formatTime(a.slot)}`"
              chevron
              clickable
              @click="router.push({ name: 'appointment-management' })"
            />
          </AppCard>

          <div class="cc-td__stats">
            <div class="cc-td__stat cc-td__stat--card">
              <AppIcon name="edit_note" :size="20" color="#9A5B15" />
              <div class="cc-td__stat-label" style="margin-top: 4px">Notes to write</div>
              <div class="cc-td__stat-value">{{ draftNoteCount }}</div>
            </div>
            <div class="cc-td__stat cc-td__stat--card">
              <AppIcon name="forum" :size="20" color="var(--cc-color-primary)" />
              <div class="cc-td__stat-label" style="margin-top: 4px">Unread</div>
              <div class="cc-td__stat-value">{{ unreadCount }}</div>
            </div>
          </div>

          <AppListRow
            title="Manage availability"
            subtitle="Weekly template and booking rules"
            icon="event_available"
            chevron
            clickable
            @click="router.push({ name: 'therapist-availability' })"
          />
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { AppPullToRefresh } from '@/components/ui';
import { computed } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import {
  AppAvatar,
  AppBadge,
  AppCard,
  AppIcon,
  AppListRow,
  MoneyAmount,
} from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { useAppointments } from '@/composables/useAppointments';
import { useCaseFiles } from '@/composables/useCaseFiles';
import { useChatThreads } from '@/composables/useChat';
import { useWallet } from '@/composables/useWallet';
import { useAuthStore } from '@/stores/auth';

/** TD1 · Dashboard (Today). Earnings figure substituted with real wallet
 * balance — a dedicated earnings/payouts read comes with TD6. */
const router = useRouter();
const auth = useAuthStore();

const fullName = computed(() => (auth.user ? `Dr. ${auth.user.lastName}` : ''));
const formattedDate = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const appointmentsQuery = useAppointments();
const todaysAppointments = computed(() => {
  const today = new Date().toDateString();
  return (appointmentsQuery.data.value?.data ?? []).filter(
    (a) => new Date(a.slot).toDateString() === today,
  );
});
const pendingRequests = computed(
  () => appointmentsQuery.data.value?.data.filter((a) => a.status === 'requested') ?? [],
);

const { data: caseFiles } = useCaseFiles();
const draftNoteCount = computed(
  () => caseFiles?.value?.data.reduce((sum, cf) => sum + cf.notes.filter((n) => n.draft).length, 0) ?? 0,
);

const { data: threads } = useChatThreads();
const unreadCount = computed(() => threads?.value?.reduce((sum, t) => sum + t.unreadCount, 0) ?? 0);

const { data: wallet } = useWallet();

/** Expired reads differently from never-subscribed; both need a plan. */
const planBannerTitle = computed(() =>
  auth.user?.therapistProfile?.status === 'expired'
    ? 'Your therapist plan has expired'
    : 'Choose a plan to start taking clients',
);

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function goRequests() {
  router.push({ name: 'appointment-management' });
}
function goCalendar() {
  router.push({ name: 'therapist-calendar' });
}
function goPlan() {
  router.push({ name: 'therapist-plan' });
}
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-td__header {
  /* TD1 sets the identity row apart from the status bar above and the stats
     below; without the vertical padding the three items read as one block. */
  padding: calc(env(safe-area-inset-top) + 12px) 16px 12px;
  display: flex;
  align-items: center;
  gap: 13px;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.62) 55%, rgba(247, 250, 249, 0.92));
}
.cc-td__greeting {
  flex: 1;
  /* Keeps a long name from crowding the role badge. */
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.cc-td__date {
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 17px;
  color: var(--cc-color-primary);
}
.cc-td__stats {
  display: flex;
  gap: 9px;
  padding: 14px 16px 0;
}
.cc-td__stat {
  flex: 1;
  background: var(--cc-surface-0);
  border: 1px solid var(--cc-line);
  border-radius: 14px;
  padding: 10px 12px;
}
.cc-td__stat--card {
  padding: 12px;
}
.cc-td__stat-label {
  font-family: var(--cc-font-interface);
  font-size: 10.5px;
  color: var(--cc-ink-400);
}
.cc-td__stat-value {
  font-family: var(--cc-font-interface);
  font-weight: 700;
  font-size: 17px;
}
.cc-td__body {
  padding: 14px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cc-td__banner,
.cc-td__plan-banner {
  display: flex;
  gap: 11px;
  align-items: center;
  cursor: pointer;
}
.cc-td__plan-banner {
  margin-bottom: 12px;
  background: var(--cc-color-mist);
  border-color: transparent;
}
.cc-td__banner-body {
  flex: 1;
}
.cc-home__section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
