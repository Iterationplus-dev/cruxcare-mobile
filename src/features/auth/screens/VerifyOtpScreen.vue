<template>
  <ion-page>
    <ion-header class="cc-otp-header">
      <ion-toolbar class="cc-otp-header__bar">
        <ion-buttons slot="start">
          <ion-back-button default-href="/auth/welcome" text="" aria-label="Back" />
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <h2 class="cc-text-h1" style="margin: 0 0 6px">Enter the 5-digit code</h2>
        <p class="cc-text-body" style="margin: 0 0 22px; font-size: 13.5px">
          {{ deliveryMessage }} <a href="#" @click.prevent="onChangeContact">change {{ contactKind }}</a>
        </p>

        <OtpInput
          v-model="code"
          :length="5"
          :cooldown-remaining="cooldown"
          @complete="onComplete"
          @resend="onResend"
        />

        <div class="cc-otp-hint">
          <AppIcon :name="deliveryIcon" :size="20" color="var(--cc-color-primary)" />
          <p>Codes expire after 10 minutes. Three wrong attempts locks the code and sends a fresh one.</p>
        </div>
      </div>

      <div class="cc-screen__footer">
        <AppButton :disabled="code.length < 5" :loading="verifying" @click="onComplete(code)">
          Verify
        </AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonToolbar,
} from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { authApi, type OtpChannel } from '@/api/auth.api';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import OtpInput from '@/components/ui/OtpInput.vue';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';

/**
 * Serves the client signup lane (A3/CA3) today; recovery (AR2) and the
 * therapist Crux ID lane (TA2) reuse this same component per the design
 * note "A3 serves both lanes" — distinguished by the `purpose`/`redirect`
 * query params rather than forked into separate screens.
 * Screenshot renders 5 boxes ("Enter the 5-digit code") though SCREENS.md's
 * text note says six — following the pixel-accurate screenshot per
 * CLAUDE.md's fidelity precedence.
 */
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const toast = useToast();

const purpose = (route.query.purpose as 'signup' | 'recovery' | 'member-link') ?? 'signup';
const requestedChannel = route.query.channel;
const channel: OtpChannel = requestedChannel === 'email' || requestedChannel === 'sms' || requestedChannel === 'whatsapp'
  ? requestedChannel
  : purpose === 'signup'
    ? 'email'
    : 'sms';
const contact = (route.query.contact as string) ?? (channel === 'email' ? auth.user?.email : auth.user?.phone) ?? '';
const contactKind = channel === 'email' ? 'email' : channel === 'whatsapp' ? 'WhatsApp' : 'number';
const deliveryLabel = channel === 'email' ? 'email' : channel === 'whatsapp' ? 'WhatsApp' : 'phone';
const deliveryIcon = channel === 'email' ? 'mail' : channel === 'whatsapp' ? 'chat' : 'sms';
const initialResendAvailableAt = typeof route.query.resendAvailableAt === 'string'
  ? route.query.resendAvailableAt
  : undefined;
/**
 * Callers that dispatched a code before navigating say so with `sent=true`.
 * Login and the pending-signup route guard cannot: `/auth/login` only issues a
 * session, so those lanes arrive with nothing sent and the screen must ask for
 * its own code on mount, or the user waits for mail that was never queued.
 */
const codeAlreadySent = route.query.sent === 'true';
const redirectName = (route.query.redirect as string) ?? 'health-profile-gate';
const cruxId = route.query.cruxId as string | undefined;
const identifier = route.query.identifier as string | undefined;

const maskedContact = computed(() => contact || 'your registered contact');

const sending = ref(false);
const sendFailed = ref(false);

const deliveryMessage = computed(() => {
  if (sending.value) return `Sending your code to ${maskedContact.value}…`;
  if (sendFailed.value) return `We could not send a code to ${maskedContact.value}. Tap resend to try again.`;
  return `Your code is on its way to ${maskedContact.value}.`;
});

async function onChangeContact() {
  if (purpose === 'signup' && channel === 'email') {
    await router.push({
      name: 'register-change-email',
      query: { redirect: redirectName },
    });
    return;
  }

  router.back();
}

const code = ref('');
const verifying = ref(false);
const cooldown = ref(0);
let timer: ReturnType<typeof setInterval> | undefined;

function secondsUntil(resendAvailableAt?: string): number {
  const timestamp = resendAvailableAt ? Date.parse(resendAvailableAt) : Number.NaN;
  if (Number.isFinite(timestamp)) {
    return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
  }

  // Recovery's non-enumerating response intentionally omits timing metadata.
  return 60;
}

function startCooldown(resendAvailableAt?: string) {
  cooldown.value = secondsUntil(resendAvailableAt);
  clearInterval(timer);
  timer = setInterval(() => {
    if (cooldown.value > 0) cooldown.value -= 1;
    else clearInterval(timer);
  }, 1000);
}

/** Recovery stays non-enumerating, so it reports no delivery timing to echo back. */
async function requestCode(): Promise<string | undefined> {
  if (purpose === 'recovery' && identifier) {
    await authApi.requestPasswordReset(identifier, channel);
    return undefined;
  }

  const delivery = await authApi.requestOtp(channel, purpose);
  return delivery.resendAvailableAt;
}

async function sendInitialCode() {
  sending.value = true;
  try {
    startCooldown(await requestCode());
    sendFailed.value = false;
  } catch (e) {
    // The server's resend cooldown means a code went out moments ago and is
    // still live — that is the happy path, not a delivery failure.
    if (e instanceof ApiError && e.code === 'otp_cooldown') {
      const retryAfter = Number(e.meta?.retryAfterSeconds);
      if (Number.isFinite(retryAfter) && retryAfter > 0) cooldown.value = Math.ceil(retryAfter);
      sendFailed.value = false;
      return;
    }

    // Let them retry immediately — no code was queued to wait on.
    sendFailed.value = true;
    clearInterval(timer);
    cooldown.value = 0;
    const message = e instanceof ApiError ? e.message : 'We could not send your verification code.';
    await toast.show(message, 'danger', {
      title: 'Could not send code',
      dismissLabel: 'Try again',
    });
  } finally {
    sending.value = false;
  }
}

onMounted(() => {
  if (codeAlreadySent) {
    startCooldown(initialResendAvailableAt);
    return;
  }

  // Hold resend at the default interval while the first send is in flight.
  startCooldown();
  void sendInitialCode();
});
onBeforeUnmount(() => clearInterval(timer));

async function onResend() {
  if (sending.value) return;

  try {
    const resendAvailableAt = await requestCode();

    sendFailed.value = false;
    code.value = '';
    startCooldown(resendAvailableAt);
    await toast.show('Your verification code is on its way to your ' + deliveryLabel + '.', 'success', {
      title: 'Code queued',
    });
  } catch (e) {
    const message = e instanceof ApiError ? e.message : 'We could not queue a new code. Please try again.';
    await toast.show(message, 'danger', {
      title: 'Could not resend code',
      dismissLabel: 'Try again',
    });
  }
}
async function onComplete(value: string) {
  if (verifying.value || value.length < 5) return;
  verifying.value = true;
  try {
    if (purpose === 'recovery') {
      // Verified together with the new password on AR3; carry the code forward.
      router.replace({ name: redirectName, query: { identifier, code: value } });
      return;
    }
    await authApi.verifyOtp(value, purpose);
    if (purpose === 'signup') {
      // The OTP endpoint changes the account on the server. Refresh before
      // navigating so the route guard cannot bounce a verified user back here.
      await auth.refreshUser();
    }
    if (purpose === 'member-link' && cruxId) {
      await auth.linkMembership(cruxId);
    }
    await router.replace({ name: redirectName });
  } catch (e) {
    const message = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
    const attempts = e instanceof ApiError ? (e.meta?.attemptsRemaining as number) ?? null : null;
    const retryMessage = attempts === null
      ? message
      : `${message} You have ${attempts} attempt${attempts === 1 ? '' : 's'} left.`;
    code.value = '';
    await toast.show(retryMessage, 'danger', {
      title: 'Verification failed',
      dismissLabel: 'Try again',
    });
  } finally {
    verifying.value = false;
  }
}
</script>

<style scoped>
.cc-otp-header {
  box-shadow: none;
}
.cc-otp-header__bar {
  --background: var(--cc-surface-app);
  --border-width: 0;
}
.cc-screen {
  --background: var(--cc-surface-app);
  display: flex;
  flex-direction: column;
}
.cc-screen__pad {
  padding: 0 16px;
}
.cc-otp-hint,
.cc-otp-lockout {
  display: flex;
  gap: 10px;
  padding: 14px;
  border-radius: var(--cc-radius-md);
  margin-top: 14px;
}
.cc-otp-hint {
  background: var(--cc-color-mist);
}
.cc-otp-hint p,
.cc-otp-lockout p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 19px;
  color: var(--cc-ink-600);
}
.cc-otp-lockout {
  background: var(--cc-error-surface);
  border: 1px solid var(--cc-error-surface-border);
}
.cc-screen__footer {
  margin-top: auto;
  padding: 12px 16px calc(8px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
</style>
