<template>
  <ion-page>
    <AppHeader title="Profile" :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <AppCard class="cc-identity">
          <AppAvatar :name="fullName" :size="56" />
          <div>
            <div class="cc-text-h2" style="margin: 0">{{ fullName }}</div>
            <div class="cc-text-caption">{{ auth.user?.therapistProfile?.plan }} plan</div>
          </div>
        </AppCard>

        <AppCard style="padding: 0">
          <AppListRow title="Manage availability" icon="event_available" chevron clickable @click="router.push({ name: 'therapist-availability' })" />
          <AppListRow title="Switch to client context" icon="switch_account" chevron clickable :divider="false" @click="roleSheetOpen = true" />
        </AppCard>

        <AppCard style="padding: 0">
          <AppListRow title="Security and privacy" icon="shield" chevron clickable @click="router.push({ name: 'security-privacy' })" />
          <AppListRow title="Help and support" icon="help" chevron clickable :divider="false" @click="router.push({ name: 'help-support' })" />
        </AppCard>

        <button type="button" class="cc-logout" @click="logoutSheetOpen = true">Log out</button>
      </div>
    </ion-content>

    <RoleSwitchSheet v-model="roleSheetOpen" />
    <AppSheet v-model="logoutSheetOpen" title="Log out?">
      <p class="cc-text-body" style="margin: 0 0 16px">You can log back in any time.</p>
      <AppButton variant="destructive-text" style="margin-bottom: 8px; color: var(--cc-error-surface-text)" @click="onLogout">Log out</AppButton>
      <AppButton variant="text" @click="logoutSheetOpen = false">Cancel</AppButton>
    </AppSheet>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppAvatar, AppButton, AppCard, AppHeader, AppListRow, AppSheet } from '@/components/ui';
import RoleSwitchSheet from '@/features/profile/components/RoleSwitchSheet.vue';
import { useAuthStore } from '@/stores/auth';
import { fullName as formatFullName } from '@/types/user';

/** TD8 (lean) · Therapist settings — role switch lives here; account
 * deletion stays in client settings per README. */
const router = useRouter();
const auth = useAuthStore();
const fullName = computed(() => (auth.user ? formatFullName(auth.user) : ''));

const roleSheetOpen = ref(false);
const logoutSheetOpen = ref(false);

async function onLogout() {
  await auth.logout();
  router.replace({ name: 'welcome' });
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
.cc-identity {
  display: flex;
  gap: 14px;
  align-items: center;
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
