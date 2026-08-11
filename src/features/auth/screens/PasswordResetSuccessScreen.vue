<template>
  <ion-page>
    <ion-content class="cc-screen">
      <div class="cc-body">
        <div class="cc-icon"><AppIcon name="lock_reset" :size="38" color="var(--cc-color-success-text)" /></div>
        <h2 class="cc-text-h1" style="margin: 0 0 10px">Password changed</h2>
        <p class="cc-text-body" style="margin: 0 0 22px">
          You're signed out everywhere else. We sent a confirmation to your registered contact.
        </p>
        <AppCard class="cc-summary">
          <div class="cc-row"><span class="cc-text-caption">Devices signed out</span><span class="cc-text-body-strong" style="font-size: 12.5px">All others</span></div>
          <div class="cc-row"><span class="cc-text-caption">Didn't do this?</span><a href="#" class="cc-text-body-strong" style="font-size: 12.5px" @click.prevent="router.push({ name: 'help-support' })">Tell us now</a></div>
        </AppCard>
      </div>
      <div class="cc-screen__footer">
        <AppButton @click="router.replace({ name: 'login' })">Log in</AppButton>
        <p class="cc-text-caption" style="text-align: center; margin-top: 12px">
          Security activity is listed under Security and privacy
        </p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppButton, AppCard, AppIcon } from '@/components/ui';

const router = useRouter();
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
  background: rgba(46, 158, 91, 0.14);
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
  margin-bottom: 6px;
}
.cc-screen__footer {
  padding: 12px 16px calc(28px + env(safe-area-inset-bottom));
}
</style>
