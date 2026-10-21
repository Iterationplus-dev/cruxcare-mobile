<template>
  <ion-page>
    <ion-header class="cc-otp-header">
      <ion-toolbar class="cc-otp-header__bar">
        <ion-buttons slot="start">
          <!-- Not `ion-back-button`: see `onBack`. A signup waiting on a code
               has no history to go back through that the router will honour. -->
          <button
            type="button"
            class="cc-otp-header__back"
            :aria-label="purpose === 'signup' ? 'Back to sign in' : 'Back'"
            @click="onBack"
          >
            <AppIcon name="arrow_back_ios_new" :size="22" color="var(--cc-ink-900)" />
          </button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <h2 class="cc-text-h1" style="margin: 0 0 6px">Enter the 5-digit code</h2>
        <p class="cc-text-body" style="margin: 0 0 22px; font-size: 13.5px">
          {{ deliveryMessage }} {{ purposeLine }}
          <a href="#" @click.prevent="onChangeContact">change {{ contactKind }}</a>
        </p>

        <OtpInput
          v-model="code"
          :length="5"
          :cooldown-remaining="cooldown"
          @complete="onComplete"
          @resend="onResend()"
        />

        <!-- "Sent" only means queued: a number that is not on WhatsApp fails
             silently after the API has answered, so once the cooldown passes
             offer the other rails rather than only another WhatsApp attempt. -->
        <div v-if="channel === 'whatsapp' && cooldown === 0 && !sending" class="cc-otp-fallback">
          <span class="cc-text-caption">Didn't get it?</span>
          <button type="button" class="cc-otp-fallback__btn" @click="onResend('sms')">Send by SMS</button>
          <button type="button" class="cc-otp-fallback__btn" @click="onResend('email')">Send by email</button>
        </div>

        <div class="cc-otp-hint">
          <AppIcon :name="deliveryIcon" :size="20" color="var(--cc-color-primary)" />
          <p>
            <template v-if="channel === 'whatsapp'">
              Check WhatsApp for a message from {{ WHATSAPP_SENDER }}.
            </template>
            {{ expiryLine }} Three wrong attempts locks the code, and you will need to request a new one.
          </p>
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
import { IonButtons, IonContent, IonHeader, IonPage, IonToolbar } from '@ionic/vue';
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
/** A ref because "Didn't get it?" can move a WhatsApp code to SMS or email. */
const channel = ref<OtpChannel>(
  requestedChannel === 'email' || requestedChannel === 'sms' || requestedChannel === 'whatsapp'
    ? requestedChannel
    : purpose === 'signup'
      ? 'email'
      : 'sms',
);
/** Already masked by the API (`destination`); replaced whenever a resend reports a new one. */
const contact = ref((route.query.contact as string) ?? '');
const contactKind = computed(() => (channel.value === 'email' ? 'email' : channel.value === 'whatsapp' ? 'WhatsApp' : 'number'));
const deliveryLabel = computed(() => (channel.value === 'email' ? 'email' : channel.value === 'whatsapp' ? 'WhatsApp' : 'phone'));
const deliveryIcon = computed(() => (channel.value === 'email' ? 'mail' : channel.value === 'whatsapp' ? 'chat' : 'sms'));
const initialResendAvailableAt = typeof route.query.resendAvailableAt === 'string'
  ? route.query.resendAvailableAt
  : undefined;

/**
 * The WhatsApp message reads the same for every purpose — signup, recovery,
 * wallet — so the screen has to say what this code is for (handoff §19). The
 * sender is named by number too: the display name is still in Meta review and
 * some phones show only the number.
 */
const WHATSAPP_SENDER = "Crux Caring Int'l (+234 916 420 2838)";
const purposeLine = {
  signup: 'Enter it to verify your account.',
  recovery: 'Enter it to recover your account.',
  'member-link': 'Enter it to confirm your Crux ID.',
}[purpose];

/** From the server's `expiresAt`, not a hard-coded ten minutes. */
const expiresAt = ref(typeof route.query.expiresAt === 'string' ? route.query.expiresAt : undefined);
const expiryLine = computed(() => {
  const at = expiresAt.value ? new Date(expiresAt.value) : null;
  return at && !Number.isNaN(at.getTime())
    ? `This code expires at ${at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
    : 'Codes expire after 10 minutes.';
});
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

const sending = ref(false);
const sendFailed = ref(false);

/**
 * Recovery never names a destination: its replies carry `destination: null`
 * so they cannot confirm an account exists, and echoing what was typed would
 * claim a code went to an email that may have been sent to WhatsApp.
 */
const deliveryMessage = computed(() => {
  if (sending.value) return 'Sending your code…';
  if (sendFailed.value) return 'We could not send a code. Tap resend to try again.';
  if (purpose === 'recovery') return `If an account matches, we've sent a code by ${deliveryLabel.value}.`;
  if (!contact.value) return `We sent a code to your ${deliveryLabel.value}.`;
  if (channel.value === 'whatsapp') return `We sent a code to WhatsApp on ${contact.value}.`;
  if (channel.value === 'sms') return `We sent a code by SMS to ${contact.value}.`;
  return `We sent a code to ${contact.value}.`;
});

/**
 * Leaving the code screen.
 *
 * For a signup this is not ordinary back navigation, which is why the
 * `ion-back-button` that used to sit here could never work whatever its
 * `default-href` said. An account that has registered but not verified keeps a
 * session open on purpose, and the router guard redirects every route that is
 * not this screen straight back to it — so the arrow navigated, was bounced,
 * and looked broken.
 *
 * Leaving therefore means abandoning the attempt rather than stepping back
 * through history: the held session is dropped first, and only then is there
 * anywhere to go. The account itself is untouched — signing in again returns
 * here with a fresh code.
 *
 * The other lanes (recovery, Crux ID) hold no such session and have a real
 * screen behind them, so they step back normally.
 */
async function onBack() {
  if (purpose === 'signup') {
    await auth.abandonPendingSignup();
    // `replace`, so the screen they have just abandoned is not what the login
    // screen's own back button leads to.
    await router.replace({ name: 'login' });
    return;
  }

  if (window.history.state?.back) router.back();
  else await router.replace({ name: 'login' });
}

async function onChangeContact() {
  if (purpose === 'signup' && channel.value === 'email') {
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
async function requestCode(via: OtpChannel = channel.value): Promise<string | undefined> {
  if (purpose === 'recovery' && identifier) {
    await authApi.requestPasswordReset(identifier, via);
    return undefined;
  }

  const delivery = await authApi.requestOtp(via, purpose, purpose === 'member-link' ? cruxId : undefined);
  contact.value = delivery.destination ?? '';
  expiresAt.value = delivery.expiresAt;
  return delivery.resendAvailableAt;
}

/**
 * A request inside the server's cooldown is `422 otp_cooldown` with
 * `meta.retryAfterSeconds`. A code went out moments ago and is still live, so
 * this is not a failure — the countdown just restarts from the server's figure.
 */
function applyServerCooldown(e: unknown): boolean {
  if (!(e instanceof ApiError) || e.code !== 'otp_cooldown') return false;
  const retryAfter = Number(e.meta?.retryAfterSeconds);
  startCooldown(
    Number.isFinite(retryAfter) && retryAfter > 0
      ? new Date(Date.now() + retryAfter * 1000).toISOString()
      : undefined,
  );
  return true;
}

async function sendInitialCode() {
  sending.value = true;
  try {
    startCooldown(await requestCode());
    sendFailed.value = false;
  } catch (e) {
    if (applyServerCooldown(e)) {
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

/** `via` switches rail for "Didn't get it?"; omitted, it resends on the current one. */
async function onResend(via: OtpChannel = channel.value) {
  if (sending.value) return;

  sending.value = true;
  try {
    const resendAvailableAt = await requestCode(via);

    channel.value = via;
    sendFailed.value = false;
    code.value = '';
    startCooldown(resendAvailableAt);
    await toast.show('Your verification code is on its way to your ' + deliveryLabel.value + '.', 'success', {
      title: 'Code queued',
    });
  } catch (e) {
    if (applyServerCooldown(e)) return;

    const message = e instanceof ApiError ? e.message : 'We could not queue a new code. Please try again.';
    await toast.show(message, 'danger', {
      title: 'Could not resend code',
      dismissLabel: 'Try again',
    });
  } finally {
    sending.value = false;
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
    await authApi.verifyOtp(value, purpose, purpose === 'member-link' ? cruxId : undefined);
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
    // At zero the code is dead server-side; another guess cannot work.
    const retryMessage = attempts === null
      ? message
      : attempts === 0
        ? 'That code is now locked. Request a new code to try again.'
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
.cc-otp-header__back {
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
.cc-otp-fallback {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 4px 14px;
  margin-top: 4px;
}
.cc-otp-fallback__btn {
  min-height: var(--cc-touch-min);
  padding: 0;
  border: none;
  background: none;
  color: var(--cc-color-primary);
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 13.5px;
  cursor: pointer;
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
