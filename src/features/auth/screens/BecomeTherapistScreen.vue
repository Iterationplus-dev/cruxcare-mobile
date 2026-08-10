<template>
  <ion-page>
    <ion-content class="cc-screen">
      <div class="cc-hero">
        <div class="cc-hero__pill">
          <AppIcon name="verified_user" :size="17" color="#fff" />
          <span>FOR PRACTITIONERS</span>
        </div>
        <h2 class="cc-hero__title">Expand your care with CruxCare</h2>
        <p class="cc-hero__body">
          Take bookings, run video sessions and get paid. Verification takes about 10 minutes to submit.
        </p>
      </div>
      <div class="cc-screen__pad">
        <div class="cc-text-mono" style="font-size: 11.5px; color: var(--cc-ink-400)">WHAT YOU WILL NEED</div>
        <AppCard style="padding: 0">
          <AppListRow title="Your Crux ID" subtitle="Issued when you joined the cooperative" icon="badge" />
          <AppListRow title="Practice licence or certificate" subtitle="PDF or photo, plus the issuing body" icon="workspace_premium" />
          <AppListRow title="Where you practise" subtitle="Physical location, or online only" icon="storefront" :divider="false" />
        </AppCard>
        <div class="cc-notice">
          <AppIcon name="schedule" :size="20" color="var(--cc-color-primary)" />
          <p>Review takes up to 3 working days. You can set up your profile and availability while it runs.</p>
        </div>
        <div class="cc-notice cc-notice--warn">
          <AppIcon name="info" :size="20" color="#9A5B15" />
          <p>Already a client? Your login stays the same. A therapist role is added to the account you have.</p>
        </div>
      </div>
      <div class="cc-screen__footer">
        <AppButton style="margin-bottom: 10px" @click="router.push({ name: 'link-crux-id', query: { forTherapist: 'true' } })">
          Start verification
        </AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppButton, AppCard, AppIcon, AppListRow } from '@/components/ui';

// Dark teal hero sits directly under the status bar — white icons are set
// via this route's `darkStatusBar` meta (see router/index.ts).
const router = useRouter();
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-hero {
  background: var(--cc-color-primary-dark);
  color: #fff;
  padding: calc(env(safe-area-inset-top) + 8px) 22px 22px;
}
.cc-hero__pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 11.5px;
  letter-spacing: 0.04em;
  margin-bottom: 14px;
}
.cc-hero__title {
  margin: 0 0 8px;
  font-family: var(--cc-font-interface);
  font-weight: 800;
  font-size: 25px;
  line-height: 30.5px;
  letter-spacing: -0.02em;
}
.cc-hero__body {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 14.5px;
  line-height: 22px;
  color: #cde7e1;
}
.cc-screen__pad {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-notice {
  display: flex;
  gap: 10px;
  padding: 13px 14px;
  border-radius: 14px;
  background: var(--cc-color-mist);
}
.cc-notice--warn {
  background: #fff6ea;
  border: 1px solid #f0dcc0;
}
.cc-notice p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 19px;
  color: var(--cc-ink-600);
}
.cc-screen__footer {
  padding: 11px 16px calc(25px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
</style>
