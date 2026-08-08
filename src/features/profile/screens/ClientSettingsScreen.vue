<template>
  <ion-page>
    <AppHeader title="Settings" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <AppCard style="padding: 0">
          <AppListRow title="Security and privacy" icon="shield" chevron clickable @click="router.push({ name: 'security-privacy' })" />
          <AppListRow title="Notifications" icon="notifications" chevron clickable @click="router.push({ name: 'notification-settings' })" />
          <AppListRow title="Payment methods" icon="credit_card" chevron clickable :divider="false" @click="router.push({ name: 'payment-methods' })" />
        </AppCard>

        <AppCard style="padding: 0">
          <AppListRow title="Help and support" icon="help" chevron clickable :divider="false" @click="router.push({ name: 'help-support' })" />
        </AppCard>

        <div class="cc-text-caption" style="padding: 0 4px">Destructive actions</div>
        <AppCard style="padding: 0">
          <AppListRow
            title="Delete account"
            icon="delete"
            icon-color="var(--cc-error-surface-text)"
            chevron
            clickable
            :divider="false"
            @click="router.push({ name: 'delete-account' })"
          />
        </AppCard>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppCard, AppHeader, AppListRow } from '@/components/ui';

/** CD8 · Client settings — destructive actions isolated in their own card. */
const router = useRouter();
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
</style>
