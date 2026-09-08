<template>
  <ion-page>
    <AppHeader title="Profile" :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <!-- Tappable for the same reason the client profile is: this is where
             a therapist changes the photo clients see. Splitting the editable
             fields onto their own screen left the therapist shell with no route
             to it at all. -->
        <button type="button" class="cc-identity" @click="router.push({ name: 'edit-profile' })">
          <AppAvatar :name="fullName" :src="auth.user?.avatarUrl ?? undefined" :size="56" />
          <div class="cc-identity__body">
            <div class="cc-text-h2" style="margin: 0">{{ fullName }}</div>
            <div class="cc-text-caption">{{ planCaption }}</div>
            <!-- What the plan costs, from the same catalogue the purchase
                 screen quotes. Hidden on a free or absent plan: "$0" reads as
                 a price someone is paying. -->
            <div v-if="planAmount" class="cc-identity__amount cc-text-mono">{{ planAmount }}</div>
          </div>
          <span class="cc-identity__edit" aria-hidden="true">
            <AppIcon name="edit" :size="18" color="var(--cc-color-primary)" />
          </span>
        </button>

        <AppCard style="padding: 0">
          <AppListRow
            :title="auth.therapistPlanActive ? 'Therapist plan' : 'Choose a therapist plan'"
            :subtitle="planRowSubtitle"
            icon="workspace_premium"
            chevron
            clickable
            @click="router.push({ name: 'therapist-plan' })"
          />
          <AppListRow title="Areas of specialization" subtitle="What clients see you treat" icon="spa" chevron clickable @click="router.push({ name: 'therapist-specialties' })" />
          <AppListRow title="Manage availability" icon="event_available" chevron clickable @click="router.push({ name: 'therapist-availability' })" />
          <AppListRow title="Payout account" subtitle="Set where your earnings are paid" icon="payments" chevron clickable @click="router.push({ name: 'therapist-payout-account' })" />
          <!-- The therapist shell has no Wallet tab, so funding is reached here. -->
          <AppListRow title="Fund wallet" subtitle="Top up by card or bank transfer" icon="add_card" chevron clickable @click="router.push({ name: 'wallet-top-up' })" />
          <AppListRow title="Edit profile" :subtitle="auth.user?.avatarUrl ? 'Photo, name and about' : 'Add a photo so clients recognise you'" icon="edit" chevron clickable @click="router.push({ name: 'edit-profile' })" />
          <AppListRow title="Profile information" subtitle="Email, phone and Crux ID" icon="badge" chevron clickable @click="router.push({ name: 'personal-info' })" />
          <AppListRow title="Switch to client context" icon="switch_account" chevron clickable :divider="false" @click="roleSheetOpen = true" />
        </AppCard>

        <AppCard style="padding: 0">
          <AppListRow title="Security and privacy" icon="shield" chevron clickable @click="router.push({ name: 'security-privacy' })" />
          <AppListRow title="Help and support" icon="help" chevron clickable :divider="false" @click="router.push({ name: 'help-support' })" />
        </AppCard>

        <button type="button" class="cc-logout" @click="logoutSheetOpen = true">Log out</button>

        <p class="cc-text-caption cc-version">{{ appVersion }}</p>
      </div>
    </ion-content>

    <RoleSwitchSheet v-model="roleSheetOpen" />
    <LogoutSheet v-model="logoutSheetOpen" />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { App as CapacitorApp } from '@capacitor/app';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import {
  AppAvatar,
  AppCard,
  AppHeader,
  AppIcon,
  AppListRow,
} from '@/components/ui';
import LogoutSheet from '@/features/profile/components/LogoutSheet.vue';
import RoleSwitchSheet from '@/features/profile/components/RoleSwitchSheet.vue';
import { useAuthStore } from '@/stores/auth';
import { findPlan, planPrice } from '@/features/therapist/plans';
import { therapistsApi } from '@/api/therapists.api';
import { useQuery } from '@tanstack/vue-query';
import { fullName as formatFullName } from '@/types/user';

/** TD8 (lean) · Therapist settings — role switch lives here; account
 * deletion stays in client settings per README. */
const router = useRouter();
const auth = useAuthStore();

/**
 * Shown so a therapist reporting a problem can say which build they are on.
 * Native gives the real version; on web there is none to read, so the field
 * says so rather than inventing a number.
 */
const appVersion = ref('Version unavailable');
onMounted(async () => {
  try {
    const info = await CapacitorApp.getInfo();
    appVersion.value = `Version ${info.version} (${info.build})`;
  } catch {
    // Web build, or the plugin is unavailable — leave the fallback.
  }
});
const fullName = computed(() => (auth.user ? formatFullName(auth.user) : ''));

const PLAN_LABELS: Record<string, string> = {
  'free-trial': 'Free trial',
  monthly: 'Monthly',
  yearly: 'Yearly',
};
const planLabel = computed(() => {
  const plan = auth.user?.therapistProfile?.plan;
  return plan ? PLAN_LABELS[plan] ?? plan : null;
});
/** Accounts that predate plan selection have the role but no plan at all. */
const planCaption = computed(() =>
  auth.therapistPlanActive && planLabel.value ? `${planLabel.value} plan` : 'No active plan',
);
/** Only when they are actually on a paid plan — an inactive or free account
 *  shows no figure rather than one it is not paying. */
const { data: plans } = useQuery({
  queryKey: ['therapist', 'plans'],
  queryFn: () => therapistsApi.plans(),
  staleTime: 5 * 60 * 1000,
});

const planAmount = computed(() => {
  if (!auth.therapistPlanActive) return '';
  return planPrice(findPlan(plans.value, auth.user?.therapistProfile?.plan));
});

const planRowSubtitle = computed(() => {
  if (auth.therapistPlanActive && planLabel.value) return `${planLabel.value} · change or upgrade`;
  if (auth.user?.therapistProfile?.status === 'expired') return 'Your plan expired — resubscribe to take clients';
  return 'Subscribe to start taking clients';
});

const roleSheetOpen = ref(false);
const logoutSheetOpen = ref(false);
</script>

<style scoped>
.cc-identity__body {
  flex: 1;
  min-width: 0;
  text-align: left;
}
.cc-identity__edit {
  flex: none;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 999px;
  background: var(--cc-color-mist);
}
.cc-identity__amount {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 600;
  color: var(--cc-color-primary);
}
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cc-identity {
  display: flex;
  gap: 14px;
  align-items: center;
  width: 100%;
  padding: 16px;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-lg);
  background: var(--cc-surface-0);
  cursor: pointer;
  font: inherit;
}
.cc-identity:focus-visible {
  outline: 3px solid rgba(14, 124, 107, 0.35);
  outline-offset: 2px;
}
.cc-version {
  margin: 14px 0 0;
  text-align: center;
  color: var(--cc-ink-300);
}
.cc-logout {
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
</style>
