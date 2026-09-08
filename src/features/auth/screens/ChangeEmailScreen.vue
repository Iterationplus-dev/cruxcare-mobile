<template>
  <ion-page>
    <ion-header class="cc-plain-header">
      <ion-toolbar class="cc-plain-header__bar">
        <ion-buttons slot="start">
          <button type="button" class="cc-plain-header__back" aria-label="Back to verification" @click="goBack">
            <AppIcon name="arrow_back_ios_new" :size="22" color="var(--cc-ink-900)" />
          </button>
        </ion-buttons>
        <ion-title>Change email</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <h2 class="cc-text-h1">Where should we send your code?</h2>
        <p class="cc-text-body">
          Enter the new email for this account. We will invalidate the previous code and send a fresh one.
        </p>

        <AppInput
          v-model="email"
          label="New email address"
          type="email"
          inputmode="email"
          autocomplete="email"
          placeholder="you@example.com"
          :error="emailError"
          @blur="touched = true"
        />

        <div class="cc-email-notice">
          <AppIcon name="mail" :size="20" color="var(--cc-color-primary)" />
          <p>The new address will become your sign-in email after verification.</p>
        </div>
      </div>

      <div class="cc-screen__footer">
        <AppButton :disabled="!isValidEmail" :loading="submitting" @click="onSubmit">
          Send new code
        </AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppButton, AppIcon, AppInput } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const toast = useToast();

const email = ref(auth.user?.email ?? '');
const touched = ref(false);
const submitting = ref(false);
const normalizedEmail = computed(() => email.value.trim().toLowerCase());
const isValidEmail = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail.value));
const emailError = computed(() =>
  touched.value && !isValidEmail.value ? 'Enter a valid email address.' : undefined,
);

function otpRoute() {
  return {
    name: 'register-otp',
    query: {
      purpose: 'signup',
      contact: auth.user?.email ?? '',
      channel: 'email',
      // Backing out without changing the email leaves the earlier code live.
      sent: 'true',
      redirect: (route.query.redirect as string) ?? 'health-profile-gate',
    },
  };
}

function goBack() {
  if (window.history.state?.back) router.back();
  else void router.replace(otpRoute());
}

async function onSubmit() {
  touched.value = true;
  if (!isValidEmail.value || submitting.value) return;

  submitting.value = true;
  try {
    const delivery = await auth.changeSignupEmail(normalizedEmail.value);
    await router.replace({
      name: 'register-otp',
      query: {
        purpose: 'signup',
        contact: delivery.destination ?? normalizedEmail.value,
        channel: 'email',
        resendAvailableAt: delivery.resendAvailableAt,
        sent: 'true',
        redirect: (route.query.redirect as string) ?? 'health-profile-gate',
      },
    });
    await toast.show('A fresh verification code is on its way to your new email.', 'success', {
      title: 'Email updated',
      dismissLabel: 'Okay',
    });
  } catch (error) {
    const message = error instanceof ApiError
      ? error
      : 'We could not update your email. Please try again.';
    await toast.show(message, 'danger', {
      title: 'Could not change email',
      dismissLabel: 'Try again',
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
  --background: var(--cc-surface-app);
  --border-width: 0;
}
.cc-plain-header__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--cc-touch-min);
  height: var(--cc-touch-min);
  border: none;
  background: transparent;
  cursor: pointer;
}
.cc-screen {
  --background: var(--cc-surface-app);
  display: flex;
  flex-direction: column;
}
.cc-screen__pad {
  padding: 8px 16px 0;
}
.cc-screen__pad h2 {
  margin: 0 0 6px;
}
.cc-screen__pad > p {
  margin: 0 0 22px;
  font-size: 13.5px;
}
.cc-email-notice {
  display: flex;
  gap: 10px;
  padding: 14px;
  margin-top: 16px;
  border-radius: var(--cc-radius-md);
  background: var(--cc-color-mist);
}
.cc-email-notice p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 19px;
  color: var(--cc-ink-600);
}
.cc-screen__footer {
  margin-top: auto;
  padding: 12px 16px calc(8px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
</style>