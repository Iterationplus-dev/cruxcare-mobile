<template>
  <ion-page>
    <ion-header class="cc-login-header">
      <ion-toolbar class="cc-login-header__bar">
        <ion-buttons slot="start">
          <ion-back-button default-href="/auth/welcome" text="" aria-label="Back" />
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <div class="cc-login-mark">
          <img :src="logoMark" class="cc-login-mark__image" alt="" />
        </div>
        <h2 class="cc-text-h1" style="margin: 0 0 5px; text-align: center">Welcome back</h2>
        <p class="cc-text-body" style="margin: 0 0 20px; font-size: 13.5px; text-align: center">
          Log in with the email or phone on your account.
        </p>

        <div v-if="formError" class="cc-login-error">
          <AppIcon name="error" :size="20" color="var(--cc-error-surface-text)" />
          <div>
            <div class="cc-login-error__title">{{ formError }}</div>
            <div v-if="attemptsRemaining !== null" class="cc-login-error__subtitle">
              {{ attemptsRemaining }} attempt{{ attemptsRemaining === 1 ? '' : 's' }} left before a
              15-minute pause.
            </div>
          </div>
        </div>

        <AppInput
          v-model="identifier"
          label="Email or phone"
          placeholder="amara.okafor@gmail.com"
          autocomplete="username"
        />

        <AppInput
          v-model="password"
          label="Password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          :invalid="!!formError"
        >
          <template #trailing>
            <button type="button" class="cc-visibility-toggle" @click="showPassword = !showPassword">
              <AppIcon :name="showPassword ? 'visibility' : 'visibility_off'" :size="20" color="var(--cc-ink-400)" />
            </button>
          </template>
        </AppInput>

        <div v-if="usingMockApi && !formError" class="cc-login-test-account">
          <div>
            <div class="cc-login-test-account__title">Mock UI test account</div>
            <div class="cc-login-test-account__detail">Pre-filled for local testing</div>
          </div>
          <button
            type="button"
            class="cc-login-test-account__button"
            :disabled="submitting"
            @click="loginWithMockAccount"
          >
            {{ submitting ? 'Signing in…' : 'Use & log in' }}
          </button>
        </div>

        <div class="cc-login-row">
          <label v-if="!formError" class="cc-login-remember">
            <input v-model="keepLoggedIn" type="checkbox" class="cc-consent__box" />
            <span class="cc-text-body" style="font-size: 13.5px">Keep me logged in</span>
          </label>
          <span v-else />
          <a href="#" class="cc-text-body-strong" style="font-size: 13.5px" @click.prevent="goForgotPassword">
            Forgot password?
          </a>
        </div>

        <AppButton :loading="submitting" style="margin: 16px 0 0" @click="onSubmit">Log in</AppButton>

        <div v-if="!formError" class="cc-or-divider">
          <span /><span class="cc-text-caption">or</span><span />
        </div>
        <AppButton
          v-if="!formError"
          variant="secondary"
          icon="fingerprint"
          @click="onBiometricLogin"
        >
          Use Face ID or fingerprint
        </AppButton>

        <div v-if="formError" class="cc-login-recovery">
          <AppIcon name="support_agent" :size="20" color="var(--cc-color-primary)" />
          <p>
            Locked out for good?
            <a href="#" @click.prevent="router.push({ name: 'assisted-recovery' })">Start account recovery</a>
            and an agent verifies you.
          </p>
        </div>
      </div>

      <div class="cc-screen__footer">
        <div class="cc-text-body" style="text-align: center; font-size: 12.5px">
          New to CruxCare? <a href="#" @click.prevent="router.push({ name: 'register' })">Create an account</a>
        </div>
        <div v-if="!formError" class="cc-text-body" style="text-align: center; font-size: 12.5px">
          Are you a therapist?
          <a href="#" @click.prevent="router.push({ name: 'become-therapist' })">Become a therapist</a>
        </div>
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
  IonToolbar,
} from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import { biometric } from '@/services/biometric';
import { useAuthStore } from '@/stores/auth';
import { ApiError } from '@/types/api';
import logoMark from '@/assets/images/logo-mark.png';
import { uiTestCredentials } from '@/mocks/testAccount';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const identifier = ref('');
const password = ref('');
const showPassword = ref(false);
const keepLoggedIn = ref(true);
const submitting = ref(false);
const formError = ref('');
const attemptsRemaining = ref<number | null>(null);
const usingMockApi = import.meta.env.VITE_USE_API_MOCKS === 'true';

function fillMockCredentials() {
  identifier.value = uiTestCredentials.identifier;
  password.value = uiTestCredentials.password;
  formError.value = '';
  attemptsRemaining.value = null;
}

async function loginWithMockAccount() {
  fillMockCredentials();
  await onSubmit();
}

async function onSubmit() {
  formError.value = '';
  attemptsRemaining.value = null;
  const normalizedIdentifier = identifier.value.trim();

  if (!normalizedIdentifier) {
    formError.value = 'Enter your email address or phone number.';
    return;
  }
  if (!password.value) {
    formError.value = 'Enter your password.';
    return;
  }

  submitting.value = true;
  try {
    await auth.login(normalizedIdentifier, password.value, keepLoggedIn.value);
    navigateAfterLogin();
  } catch (e) {
    if (e instanceof ApiError) {
      formError.value = e.status === 401 ? 'Email or password is wrong' : e.message;
      attemptsRemaining.value = (e.meta?.attemptsRemaining as number) ?? null;
    } else {
      formError.value = 'Something went wrong. Please try again.';
    }
  } finally {
    submitting.value = false;
  }
}

async function onBiometricLogin() {
  const enabled = await biometric.isEnabledOnDevice();
  if (!enabled) {
    formError.value = 'Biometric login is not set up on this device yet.';
    return;
  }
  const ok = await biometric.verify('Log in to CruxCare');
  if (!ok) return;
  await auth.hydrate();
  if (auth.isAuthenticated) navigateAfterLogin();
}

function goForgotPassword() {
  router.push({ name: 'forgot-password' });
}

function navigateAfterLogin() {
  if (route.query.redirect === 'link-crux-id') {
    router.replace({ name: 'link-crux-id', query: { forTherapist: 'true' } });
    return;
  }

  router.replace({ name: 'tabs-home' });
}
</script>

<style scoped>
.cc-login-header {
  box-shadow: none;
}
.cc-login-header__bar {
  --background: var(--cc-surface-app);
  --border-width: 0;
}
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 8px 16px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-login-mark {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 96px;
  height: 96px;
  margin: 6px auto 10px;
  border-radius: 50%;
  background: radial-gradient(circle at 50% 42%, #ffffff 0 58%, #f5fbf9 100%);
  box-shadow:
    0 16px 38px rgba(19, 117, 101, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.92);
}
.cc-login-mark__image {
  width: 56px;
  height: auto;
}
.cc-login-error {
  display: flex;
  gap: 10px;
  padding: 13px 14px;
  border-radius: var(--cc-radius-md);
  background: var(--cc-error-surface);
  border: 1px solid var(--cc-error-surface-border);
}
.cc-login-error__title {
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 13.5px;
  color: var(--cc-error-surface-text);
  margin-bottom: 2px;
}
.cc-login-error__subtitle {
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  color: var(--cc-ink-600);
}
.cc-login-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.cc-login-test-account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px dashed #9bc9be;
  border-radius: var(--cc-radius-md);
  background: var(--cc-color-mist);
}
.cc-login-test-account__title {
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 12.5px;
  color: var(--cc-ink-900);
}
.cc-login-test-account__detail {
  margin-top: 2px;
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  color: var(--cc-ink-600);
}
.cc-login-test-account__button {
  flex: none;
  min-height: 36px;
  padding: 0 11px;
  border: none;
  border-radius: 9px;
  background: var(--cc-color-primary);
  color: #fff;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
}
.cc-login-test-account__button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.cc-login-remember {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.cc-consent__box {
  width: 20px;
  height: 20px;
  accent-color: var(--cc-color-primary);
}
.cc-visibility-toggle {
  background: none;
  border: none;
  padding: 0;
  display: flex;
  cursor: pointer;
}
.cc-or-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
}
.cc-or-divider span:not(.cc-text-caption) {
  flex: 1;
  height: 1px;
  background: var(--cc-divider);
}
.cc-login-recovery {
  display: flex;
  gap: 10px;
  padding: 13px 14px;
  border-radius: var(--cc-radius-md);
  background: var(--cc-color-mist);
  margin-top: 4px;
}
.cc-login-recovery p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 19px;
  color: var(--cc-ink-600);
}
.cc-screen__footer {
  margin-top: auto;
  padding: 11px 16px calc(25px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
  display: flex;
  flex-direction: column;
  gap: 9px;
}
</style>
