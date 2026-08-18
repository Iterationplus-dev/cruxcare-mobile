<template>
  <ion-page>
    <ion-header class="cc-plain-header">
      <ion-toolbar class="cc-plain-header__bar">
        <ion-buttons slot="start">
          <button type="button" class="cc-plain-header__back" aria-label="Back" @click="goBack">
            <AppIcon name="arrow_back_ios_new" :size="22" color="var(--cc-ink-900)" />
          </button>
        </ion-buttons>
        <ion-title>Forgot password</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <h2 class="cc-text-h1" style="margin: 0 0 6px">Let's get you back in</h2>
        <p class="cc-text-body" style="margin: 0 0 18px; font-size: 13.5px">
          Tell us where to send a reset code. It has to be the email or phone already on the account.
        </p>

        <div class="cc-channels">
          <button
            v-for="option in channelOptions"
            :key="option.key"
            type="button"
            class="cc-channel"
            :class="{ 'cc-channel--selected': channel === option.key }"
            :aria-pressed="channel === option.key"
            @click="channel = option.key"
          >
            <AppIcon
              :name="option.icon"
              :size="20"
              :color="channel === option.key ? 'var(--cc-color-primary)' : 'var(--cc-ink-400)'"
            />
            <div class="cc-text-body-strong" style="font-size: 13.5px">{{ option.label }}</div>
          </button>
        </div>

        <AppInput
          v-model="identifier"
          label="Email or phone"
          placeholder="amara.okafor@gmail.com"
          autocomplete="username"
        />

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
import { IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppButton, AppIcon, AppInput } from '@/components/ui';
import { authApi } from '@/api/auth.api';

const router = useRouter();

/** ion-back-button did nothing here when login was reached via replace(). */
function goBack() {
  if (window.history.state?.back) router.back();
  else router.replace({ name: 'login' });
}
type RecoveryChannel = 'sms' | 'whatsapp' | 'email';

/** WhatsApp and SMS both reach the account phone; the API validates all three. */
const channelOptions: { key: RecoveryChannel; icon: string; label: string }[] = [
  { key: 'sms', icon: 'sms', label: 'Text me' },
  { key: 'whatsapp', icon: 'chat', label: 'WhatsApp' },
  { key: 'email', icon: 'mail', label: 'Email me' },
];

const channel = ref<RecoveryChannel>('sms');
const identifier = ref('');
const submitting = ref(false);

async function onSubmit() {
  submitting.value = true;
  try {
    await authApi.requestPasswordReset(identifier.value, channel.value);
    router.push({
      name: 'register-otp',
      query: { purpose: 'recovery', contact: identifier.value, channel: channel.value, sent: 'true', redirect: 'reset-password', identifier: identifier.value },
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
.cc-plain-header__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--cc-touch-min);
  height: var(--cc-touch-min);
  background: none;
  border: none;
  cursor: pointer;
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
  /* Three across on a 360dp screen — let them shrink rather than overflow. */
  min-width: 0;
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
  font-size: 12.5px;
  line-height: 19px;
  color: var(--cc-ink-600);
}
.cc-screen__footer {
  padding: 11px 16px calc(25px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
</style>
