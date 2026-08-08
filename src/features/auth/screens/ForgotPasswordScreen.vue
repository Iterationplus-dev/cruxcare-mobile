<template>
  <ion-page>
    <ion-header class="cc-plain-header">
      <ion-toolbar class="cc-plain-header__bar">
        <ion-buttons slot="start"><ion-back-button default-href="/auth/login" text="" /></ion-buttons>
        <ion-title>Forgot password</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <h2 class="cc-text-h1" style="margin: 0 0 6px">Let's get you back in</h2>
        <p class="cc-text-body" style="margin: 0 0 18px; font-size: 13px">
          Tell us where to send a reset code. It has to be the email or phone already on the account.
        </p>

        <div class="cc-channels">
          <button
            type="button"
            class="cc-channel"
            :class="{ 'cc-channel--selected': channel === 'sms' }"
            @click="channel = 'sms'"
          >
            <AppIcon name="sms" :size="20" color="var(--cc-color-primary)" />
            <div class="cc-text-body-strong" style="font-size: 13px">Text me</div>
          </button>
          <button
            type="button"
            class="cc-channel"
            :class="{ 'cc-channel--selected': channel === 'email' }"
            @click="channel = 'email'"
          >
            <AppIcon name="mail" :size="20" color="var(--cc-ink-400)" />
            <div class="cc-text-body-strong" style="font-size: 13px">Email me</div>
          </button>
        </div>

        <AppInput v-model="identifier" label="Email or phone" autocomplete="username" />

        <div class="cc-notice">
          <AppIcon name="shield" :size="20" color="var(--cc-color-primary)" />
          <p>Resetting a password signs out every device and pauses payouts for 24 hours.</p>
        </div>
        <div class="cc-notice cc-notice--muted">
          <AppIcon name="phonelink_erase" :size="20" color="var(--cc-ink-400)" />
          <p>Lost access to both? <a href="#" @click.prevent="router.push({ name: 'assisted-recovery' })">Start account recovery</a> with an agent instead.</p>
        </div>
      </div>
      <div class="cc-screen__footer">
        <AppButton :loading="submitting" @click="onSubmit">Send reset code</AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppButton, AppIcon, AppInput } from '@/components/ui';
import { authApi } from '@/api/auth.api';

const router = useRouter();
const channel = ref<'sms' | 'email'>('sms');
const identifier = ref('');
const submitting = ref(false);

async function onSubmit() {
  submitting.value = true;
  try {
    await authApi.requestPasswordReset(identifier.value, channel.value === 'sms' ? 'sms' : 'email');
    router.push({
      name: 'register-otp',
      query: { purpose: 'recovery', contact: identifier.value, redirect: 'reset-password', identifier: identifier.value },
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.cc-plain-header {
  box-shadow: none;
}
.cc-plain-header__bar {
  --background: var(--cc-surface-0);
  --border-width: 0;
}
.cc-screen {
  --background: var(--cc-surface-0);
}
.cc-screen__pad {
  padding: 8px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-channels {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}
.cc-channel {
  flex: 1;
  border: 1px solid var(--cc-line);
  border-radius: 12px;
  padding: 11px 12px;
  background: var(--cc-surface-0);
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.cc-channel--selected {
  border: 1.5px solid var(--cc-color-primary);
  background: var(--cc-color-mist);
}
.cc-notice {
  display: flex;
  gap: 10px;
  padding: 13px 14px;
  border-radius: 14px;
  background: var(--cc-color-mist);
}
.cc-notice--muted {
  background: var(--cc-surface-app);
  border: 1px solid var(--cc-line);
}
.cc-notice p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 12px;
  line-height: 18px;
  color: var(--cc-ink-600);
}
.cc-screen__footer {
  padding: 11px 16px calc(25px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
</style>
