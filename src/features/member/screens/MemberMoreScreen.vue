<template>
  <ion-page>
    <AppHeader title="More" :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <AppCard class="cc-more__identity">
          <AppAvatar :name="name" :src="auth.user?.avatarUrl ?? undefined" :size="54" />
          <div>
            <div class="cc-text-body-strong" style="font-size: 15.5px">{{ name }}</div>
            <div class="cc-text-mono">{{ auth.user?.membership?.cruxId }}</div>
            <div class="cc-more__roles"><AppBadge label="MEMBER" /><AppBadge label="CLIENT" /></div>
          </div>
        </AppCard>

        <AppCard style="padding: 0">
          <AppListRow title="Point Facility" subtitle="Live company, encouragement and exercise" icon="card_membership" chevron clickable @click="router.push({ name: 'point-facility' })" />
          <AppListRow title="Notifications" subtitle="Updates, orders and money activity" icon="notifications" chevron clickable @click="router.push({ name: 'notifications' })" />
          <AppListRow title="Profile" subtitle="Details, roles and membership" icon="person" chevron clickable @click="router.push({ name: 'profile' })" />
          <AppListRow v-if="auth.roles.includes('admin')" title="Approvals" subtitle="Payouts, cooperative help and notices" icon="fact_check" chevron clickable @click="router.push({ name: 'admin-approvals' })" />
          <AppListRow title="Settings" icon="settings" chevron clickable :divider="false" @click="router.push({ name: 'client-settings' })" />
        </AppCard>

        <AppCard style="padding: 0">
          <AppListRow title="Switch context" subtitle="Member, client or therapist" icon="switch_account" chevron clickable @click="roleSheetOpen = true" />
          <AppListRow title="Help and support" icon="help" chevron clickable :divider="false" @click="router.push({ name: 'help-support' })" />
        </AppCard>
      </div>
    </ion-content>
    <RoleSwitchSheet v-model="roleSheetOpen" />
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppAvatar, AppBadge, AppCard, AppHeader, AppListRow } from '@/components/ui';
import RoleSwitchSheet from '@/features/profile/components/RoleSwitchSheet.vue';
import { useAuthStore } from '@/stores/auth';
import { fullName } from '@/types/user';

const auth = useAuthStore();
const router = useRouter();
const roleSheetOpen = ref(false);
const name = computed(() => (auth.user ? fullName(auth.user) : ''));
</script>

<style scoped>
.cc-screen { --background: var(--cc-surface-app); }
.cc-screen__pad { display:flex; flex-direction:column; gap:14px; padding:16px; }
.cc-more__identity { display:flex; gap:12px; align-items:center; }
.cc-more__identity .cc-text-mono { margin-top:2px; color:var(--cc-color-primary); font-size:10.5px; }
.cc-more__roles { display:flex; gap:5px; margin-top:7px; }
</style>
