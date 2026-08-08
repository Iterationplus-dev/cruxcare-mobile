<template>
  <ion-page>
    <ion-content class="cc-screen">
      <div class="cc-bio">
        <div class="cc-bio__icon">
          <AppIcon name="fingerprint" :size="48" color="var(--cc-color-primary)" />
        </div>
        <h2 class="cc-text-h1" style="margin: 0 0 10px">Unlock with your face or finger</h2>
        <p class="cc-text-body" style="margin: 0 0 24px">
          Faster sign-in, and your token stays in the device keychain. Your password always works as a
          fallback.
        </p>
        <div class="cc-bio__notes">
          <div class="cc-bio__note">
            <AppIcon name="lock" :size="20" color="var(--cc-color-primary)" />
            <p>Money actions still ask for a code or biometrics again.</p>
          </div>
          <div class="cc-bio__note">
            <AppIcon name="devices" :size="20" color="var(--cc-color-primary)" />
            <p>You can revoke this device any time from Settings.</p>
          </div>
        </div>
      </div>
      <div class="cc-screen__footer">
        <AppButton :loading="enabling" @click="onEnable">Turn on biometrics</AppButton>
        <AppButton variant="text" @click="skip">Not now</AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { biometric } from '@/services/biometric';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

/** CA5/A7 — offered once after the first successful password login. */
const router = useRouter();
const auth = useAuthStore();
const toast = useToast();
const enabling = ref(false);

async function onEnable() {
  enabling.value = true;
  try {
    const available = await biometric.isAvailable();
    if (!available) {
      await toast.show('Biometrics are not available on this device.', 'warning');
      return;
    }
    const verified = await biometric.verify('Confirm to enable biometric login');
    if (!verified) return;
    await auth.enableBiometric();
    await biometric.markEnabledOnDevice();
    await toast.show('Biometric login turned on.', 'success');
    router.replace({ name: 'tabs-home' });
  } finally {
    enabling.value = false;
  }
}

function skip() {
  router.replace({ name: 'tabs-home' });
}
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-bio {
  padding: 32px 24px 0;
  display: flex;
  flex-direction: column;
  text-align: center;
}
.cc-bio__icon {
  width: 96px;
  height: 96px;
  border-radius: var(--cc-radius-lg-max);
  background: var(--cc-color-mist);
  display: grid;
  place-items: center;
  margin: 24px auto;
}
.cc-bio__notes {
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-bio__note {
  display: flex;
  gap: 10px;
  padding: 14px;
  border-radius: var(--cc-radius-md);
  background: var(--cc-surface-app);
}
.cc-bio__note p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 13px;
  line-height: 20px;
  color: var(--cc-ink-600);
}
.cc-screen__footer {
  padding: 0 24px calc(28px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: 9px;
}
</style>
