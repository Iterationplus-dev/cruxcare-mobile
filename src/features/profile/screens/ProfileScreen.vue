<template>
  <ion-page>
    <div class="cc-profile__cover">
      <img :src="profileCover" alt="" class="cc-profile__cover-img" />
      <div class="cc-profile__cover-overlay">
        <div class="cc-profile__topbar">
          <span class="cc-text-body-strong" style="color: #fff">Profile</span>
          <button type="button" aria-label="Settings" @click="router.push({ name: 'client-settings' })">
            <AppIcon name="settings" :size="22" color="#fff" />
          </button>
        </div>
        <!-- PR1 draws no edit affordance, but PR2 has to be reachable. Tapping
             your own name and photo is the ordinary way in, and it changes
             nothing about how the header looks. -->
        <button
          type="button"
          class="cc-profile__identity"
          aria-label="Edit your profile"
          @click="router.push({ name: 'edit-profile' })"
        >
          <AppAvatar :name="fullName" :src="auth.user?.avatarUrl ?? undefined" :size="64" />
          <div class="cc-profile__identity-body">
            <div class="cc-text-h1 cc-profile__name">{{ fullName }}</div>
            <!-- PR1 puts the Crux ID directly under the name. Rendered only
                 when there is one: it comes with membership, and an empty mono
                 line reads as an id that failed to load. The username moved to
                 Personal information, beside the other verified details. -->
            <div v-if="cruxId" class="cc-text-mono cc-profile__crux-id">{{ cruxId }}</div>
            <div class="cc-profile__badges">
              <AppBadge label="CLIENT" />
              <AppBadge v-if="auth.roles.includes('member')" :label="`MEMBER${tierLabel}`" />
              <AppBadge v-if="auth.roles.includes('therapist')" label="THERAPIST" />
              <AppBadge v-if="auth.roles.includes('admin')" label="ADMIN" />
            </div>
          </div>
        </button>
      </div>
    </div>

    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['appointments'], ['orders']]" />
      <div class="cc-screen__pad">
        <div class="cc-profile__stats">
          <div class="cc-profile__stat">
            <div class="cc-text-caption">Sessions</div>
            <div class="cc-text-h2">{{ sessionsCount }}</div>
          </div>
          <div class="cc-profile__stat">
            <div class="cc-text-caption">Orders</div>
            <div class="cc-text-h2">{{ ordersCount }}</div>
          </div>
          <div class="cc-profile__stat">
            <div class="cc-text-caption">Since</div>
            <div class="cc-text-h2">{{ sinceYear }}</div>
          </div>
        </div>

        <AppCard style="padding: 0">
          <AppListRow title="Personal information" icon="person" chevron clickable @click="router.push({ name: 'personal-info' })" />
          <AppListRow title="Health profile" icon="medical_information" chevron clickable @click="router.push({ name: 'health-profile' })" />
          <AppListRow title="Security and privacy" icon="shield" chevron clickable @click="router.push({ name: 'security-privacy' })" />
          <AppListRow title="Notifications" icon="notifications" chevron clickable @click="router.push({ name: 'notification-settings' })" />
          <AppListRow title="Payment methods" icon="credit_card" chevron clickable @click="router.push({ name: 'payment-methods' })" />
          <AppListRow title="Fund wallet" subtitle="Top up by card or bank transfer" icon="add_card" chevron clickable :divider="false" @click="router.push({ name: 'wallet-top-up' })" />
        </AppCard>

        <AppCard v-if="auth.roles.includes('therapist')" style="padding: 0">
          <AppListRow title="Therapist availability" subtitle="Open time clients can book" icon="event_available" chevron clickable @click="router.push({ name: 'therapist-availability' })" />
          <AppListRow title="Payout account" subtitle="Set where your earnings are paid" icon="payments" chevron clickable @click="router.push({ name: 'therapist-payout-account' })" />
          <AppListRow title="Profile photo" :subtitle="auth.user?.avatarUrl ? 'Photo added' : 'Help clients recognise you'" icon="photo_camera" chevron clickable :divider="false" @click="router.push({ name: 'personal-info', query: { focus: 'profile-photo' } })" />
        </AppCard>

        <AppCard style="padding: 0">
          <AppListRow
            v-if="!auth.roles.includes('therapist')"
            title="Become a therapist"
            icon="medical_services"
            clickable
            @click="router.push({ name: 'become-therapist' })"
          >
            <template #trailing><AppBadge label="ADD ROLE" /></template>
          </AppListRow>
          <AppListRow
            v-if="auth.availableRoleContexts.length > 1"
            title="Switch context"
            icon="switch_account"
            chevron
            clickable
            @click="roleSheetOpen = true"
          />
          <AppListRow title="Help and support" icon="help" chevron clickable :divider="false" @click="router.push({ name: 'help-support' })" />
        </AppCard>

        <button type="button" class="cc-profile__logout" @click="logoutSheetOpen = true">Log out</button>
      </div>
    </ion-content>

    <RoleSwitchSheet v-model="roleSheetOpen" />

    <AppSheet v-model="logoutSheetOpen" title="Log out?">
      <p class="cc-text-body" style="margin: 0 0 16px">
        Any unsynced drafts on this device won't be saved. You can log back in any time.
      </p>
      <div class="cc-logout-sheet__actions">
        <AppButton variant="secondary" class="cc-logout-sheet__confirm" @click="onLogout">Log out</AppButton>
        <AppButton variant="secondary" @click="logoutSheetOpen = false">Cancel</AppButton>
      </div>
    </AppSheet>
  </ion-page>
</template>

<script setup lang="ts">
import { AppPullToRefresh } from '@/components/ui';
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import {
  AppAvatar,
  AppBadge,
  AppButton,
  AppCard,
  AppIcon,
  AppListRow,
  AppSheet,
} from '@/components/ui';
import RoleSwitchSheet from '../components/RoleSwitchSheet.vue';
import { useAppointments } from '@/composables/useAppointments';
import { useOrders } from '@/composables/useOrders';
import { useAuthStore } from '@/stores/auth';
import { fullName as formatFullName } from '@/types/user';
import profileCover from '@/assets/images/profile-cover.png';

/** PR1 · View profile. Roles rendered as badges; role-add entry point;
 * tab bar (outside this component) keeps Profile selected. */
const router = useRouter();
const auth = useAuthStore();

const fullName = computed(() => (auth.user ? formatFullName(auth.user) : ''));

/** Comes with membership, so an account without one has no id to show. */
const cruxId = computed(() => auth.user?.membership?.cruxId ?? '');
const tierLabel = computed(() => {
  const tier = auth.user?.membership?.tier;
  return tier ? ` · ${tier.split('·')[0].trim().toUpperCase()}` : '';
});

const { data: appointments } = useAppointments();
const sessionsCount = computed(
  () => appointments.value?.data.filter((a) => a.status === 'completed').length ?? 0,
);
const { data: orders } = useOrders();
const ordersCount = computed(() => orders.value?.data.length ?? 0);
const sinceYear = computed(() =>
  auth.user ? new Date(auth.user.createdAt).getFullYear() : '',
);

const roleSheetOpen = ref(false);
const logoutSheetOpen = ref(false);

async function onLogout() {
  await auth.logout();
  router.replace({ name: 'login' });
}
</script>

<style scoped>
.cc-profile__name {
  color: #fff;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cc-profile__crux-id {
  color: #cde7e1;
  font-size: 12.5px;
  letter-spacing: 0.04em;
}
.cc-profile__cover {
  position: relative;
  height: 190px;
  background: #dce9e1;
  overflow: hidden;
}
.cc-profile__cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 22%;
}
.cc-profile__cover-overlay {
  position: relative;
  z-index: 1;
  padding: calc(env(safe-area-inset-top) + 4px) 16px 0;
  height: 100%;
  box-sizing: border-box;
  background: linear-gradient(180deg, rgba(10, 90, 78, 0.15), rgba(10, 90, 78, 0.55));
  display: flex;
  flex-direction: column;
}
.cc-profile__topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.cc-profile__topbar button {
  background: none;
  border: none;
  display: flex;
  cursor: pointer;
}
.cc-profile__identity {
  display: flex;
  gap: 14px;
  align-items: center;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
}
.cc-profile__identity:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 4px;
  border-radius: 12px;
}
.cc-profile__identity-body {
  flex: 1;
}
.cc-profile__badges {
  display: flex;
  gap: 6px;
  margin-top: 7px;
}
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 14px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cc-profile__stats {
  display: flex;
  gap: 8px;
}
.cc-profile__stat {
  flex: 1;
  background: var(--cc-surface-0);
  border: 1px solid var(--cc-line);
  border-radius: 14px;
  padding: 11px 12px;
}
.cc-profile__logout {
  text-align: center;
  background: none;
  border: none;
  color: var(--cc-error-surface-text);
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 13.5px;
  padding: 6px 0;
  cursor: pointer;
}
.cc-logout-sheet__actions {
  display: grid;
  gap: 10px;
}
.cc-logout-sheet__actions :deep(.cc-logout-sheet__confirm) {
  border-color: rgba(184, 58, 42, 0.28);
  background: var(--cc-error-surface);
  color: var(--cc-error-surface-text);
}
</style>
