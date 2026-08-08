<template>
  <ion-page>
    <ion-content class="cc-screen">
      <div class="cc-body">
        <div class="cc-icon"><AppIcon name="waving_hand" :size="38" color="var(--cc-ink-400)" /></div>
        <h2 class="cc-text-h1" style="margin: 0 0 10px">Your account is scheduled for deletion</h2>
        <p class="cc-text-body" style="margin: 0 0 22px">
          You're signed out. Log in before {{ completesAtLabel }} to stop it and everything comes back.
        </p>
        <AppCard class="cc-summary">
          <div class="cc-row"><span class="cc-text-caption">Deletion completes</span><span class="cc-text-body-strong" style="font-size: 12px">{{ completesAtLabel }}</span></div>
        </AppCard>
      </div>
      <div class="cc-screen__footer">
        <AppButton style="margin-bottom: 9px" @click="router.replace({ name: 'welcome' })">Back to welcome</AppButton>
        <AppButton variant="secondary" @click="router.replace({ name: 'login' })">Log in to cancel deletion</AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppButton, AppCard, AppIcon } from '@/components/ui';

const route = useRoute();
const router = useRouter();
const completesAtLabel = computed(() => {
  const iso = route.query.completesAt as string;
  return iso
    ? new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
});
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-0);
}
.cc-body {
  padding: 48px 24px 0;
  text-align: center;
}
.cc-icon {
  width: 72px;
  height: 72px;
  border-radius: 999px;
  background: #edf1ef;
  display: grid;
  place-items: center;
  margin: 0 auto 20px;
}
.cc-summary {
  text-align: left;
}
.cc-row {
  display: flex;
  justify-content: space-between;
}
.cc-screen__footer {
  padding: 12px 16px calc(28px + env(safe-area-inset-bottom));
}
</style>
