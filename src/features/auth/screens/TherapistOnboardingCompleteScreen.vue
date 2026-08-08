<template>
  <ion-page>
    <ion-content class="cc-screen">
      <div class="cc-body">
        <div class="cc-icon"><AppIcon name="verified" :size="40" color="#fff" /></div>
        <h2 class="cc-title">You're verified</h2>
        <p class="cc-subtitle">Your listing is live and clients can book you from today.</p>
        <div class="cc-next">
          <div class="cc-text-mono" style="font-size: 11px; color: #9bd2c8; margin-bottom: 11px">FIRST THREE THINGS</div>
          <div class="cc-next__item"><AppIcon name="event_available" :size="20" color="#9bd2c8" />Open your first bookable week</div>
          <div class="cc-next__item"><AppIcon name="payments" :size="20" color="#9bd2c8" />Confirm your payout account</div>
          <div class="cc-next__item"><AppIcon name="photo_camera" :size="20" color="#9bd2c8" />Add a profile photo clients trust</div>
        </div>
      </div>
      <div class="cc-screen__footer">
        <AppButton style="margin-bottom: 10px; background: #fff; color: var(--cc-color-primary-dark)" @click="goDashboard">
          Go to therapist dashboard
        </AppButton>
        <button type="button" class="cc-text-link" @click="router.push({ name: 'therapist-availability' })">
          Set availability first
        </button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppButton, AppIcon } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();

function goDashboard() {
  auth.setActiveRole('therapist');
  router.replace({ name: 'therapist-today' });
}
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-color-primary-dark);
}
.cc-body {
  padding: 0 24px;
  text-align: center;
  padding-top: 15vh;
}
.cc-icon {
  width: 76px;
  height: 76px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  display: grid;
  place-items: center;
  margin: 0 auto 20px;
}
.cc-title {
  color: #fff;
  font-family: var(--cc-font-interface);
  font-weight: 800;
  font-size: 24px;
  margin: 0 0 10px;
}
.cc-subtitle {
  color: #cde7e1;
  font-family: var(--cc-font-interface);
  font-size: 14px;
  line-height: 22px;
  margin: 0 0 24px;
}
.cc-next {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  padding: 16px;
  text-align: left;
}
.cc-next__item {
  display: flex;
  gap: 10px;
  align-items: center;
  color: #fff;
  font-family: var(--cc-font-interface);
  font-weight: 500;
  font-size: 13px;
  margin-bottom: 10px;
}
.cc-screen__footer {
  padding: 12px 24px calc(30px + env(safe-area-inset-bottom));
}
.cc-text-link {
  display: block;
  width: 100%;
  text-align: center;
  background: none;
  border: none;
  color: #9bd2c8;
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
}
</style>
