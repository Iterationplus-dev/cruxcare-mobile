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
          Log in with your username or email address.
        </p>

        <AppInput
          v-model="identifier"
          label="Username or email"
          placeholder="amara.okafor or amara@example.com"
          type="text"
          inputmode="text"
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
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';
import { loginFailureMessage, validateLoginIdentifier } from '@/features/auth/loginIdentifier';
import { homeRouteForRole } from '@/router/roleHome';
import logoMark from '@/assets/images/logo-mark.png';
import { uiTestCredentials } from '@/mocks/testAccount';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const toast = useToast();

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

  const identifierError = validateLoginIdentifier(normalizedIdentifier);
  if (identifierError) {
    await toast.show(identifierError, 'warning', { title: 'Check your details' });
    return;
  }
  if (!password.value) {
    await toast.show('Enter your password.', 'warning', { title: 'Check your details' });
    return;
  }

  submitting.value = true;
  try {
    await auth.login(normalizedIdentifier, password.value, keepLoggedIn.value);
    navigateAfterLogin();
  } catch (e) {
    const failureMessage = e instanceof ApiError ? loginFailureMessage(e) : 'Something went wrong. Please try again.';
    formError.value = failureMessage;
    attemptsRemaining.value = e instanceof ApiError ? (e.meta?.attemptsRemaining as number) ?? null : null;
    const retryMessage = attemptsRemaining.value === null
      ? failureMessage
      : `${failureMessage} You have ${attemptsRemaining.value} attempt${attemptsRemaining.value === 1 ? '' : 's'} left before a 15-minute pause.`;
    await toast.show(retryMessage, 'danger', {
      title: 'Login failed',
      dismissLabel: 'Try again',
    });
  } finally {
    submitting.value = false;
  }
}
async function onBiometricLogin() {
  const enabled = await biometric.isEnabledOnDevice();
  if (!enabled) {
    await toast.show('Biometric login is not set up on this device yet.', 'warning', {
      title: 'Biometric sign-in unavailable',
    });
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
  if (auth.user?.emailVerified === false) {
    router.replace({
      name: 'register-otp',
      query: {
        purpose: 'signup',
        contact: auth.user.email,
        channel: 'email',
        redirect: 'health-profile-gate',
      },
    });
    return;
  }

  if (route.query.redirect === 'link-crux-id') {
    router.replace({ name: 'link-crux-id', query: { forTherapist: 'true' } });
    return;
  }

  // Therapists open on their own dashboard; the store picked the context.
  router.replace({ name: homeRouteForRole(auth.activeRole) });
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
