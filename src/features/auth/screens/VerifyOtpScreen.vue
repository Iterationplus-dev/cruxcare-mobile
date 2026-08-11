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
          Sent to {{ maskedContact }} · <a href="#" @click.prevent="router.back()">change number</a>
        </p>

        <OtpInput
          v-model="code"
          :length="5"
          :error="errorMessage && attemptsRemaining !== null ? errorText : ''"
          :cooldown-remaining="cooldown"
          @complete="onComplete"
          @resend="onResend"
        />

        <div v-if="!errorMessage" class="cc-otp-hint">
          <AppIcon name="sms" :size="20" color="var(--cc-color-primary)" />
          <p>Codes expire after 10 minutes. Three wrong attempts locks the code and sends a fresh one.</p>
        </div>
        <div v-else class="cc-otp-lockout">
          <AppIcon name="lock_clock" :size="20" color="var(--cc-error-surface-text)" />
          <p>After the next wrong attempt we send a new code and pause entry for 15 minutes.</p>
        </div>
      </div>

      <div class="cc-screen__footer">
        <AppButton :disabled="code.length < 5 && !errorMessage" :loading="verifying" @click="onComplete(code)">
          {{ errorMessage ? 'Try again' : 'Verify' }}
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
import { authApi } from '@/api/auth.api';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import OtpInput from '@/components/ui/OtpInput.vue';
import { useAuthStore } from '@/stores/auth';
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

const purpose = (route.query.purpose as 'signup' | 'recovery' | 'member-link') ?? 'signup';
const contact = (route.query.contact as string) ?? auth.user?.phone ?? '';
const redirectName = (route.query.redirect as string) ?? 'health-profile-gate';
const cruxId = route.query.cruxId as string | undefined;
const identifier = route.query.identifier as string | undefined;

const maskedContact = computed(() => contact || 'your registered contact');

const code = ref('');
const verifying = ref(false);
const errorMessage = ref('');
const attemptsRemaining = ref<number | null>(null);
const cooldown = ref(30);
let timer: ReturnType<typeof setInterval> | undefined;

const errorText = computed(() =>
  errorMessage.value
    ? `${errorMessage.value}${attemptsRemaining.value !== null ? ` ${attemptsRemaining.value} attempt${attemptsRemaining.value === 1 ? '' : 's'} left.` : ''}`
    : '',
);

function startCooldown() {
  cooldown.value = 30;
  clearInterval(timer);
  timer = setInterval(() => {
    if (cooldown.value > 0) cooldown.value -= 1;
    else clearInterval(timer);
  }, 1000);
}

onMounted(startCooldown);
onBeforeUnmount(() => clearInterval(timer));

async function onResend() {
  if (purpose === 'recovery' && identifier) {
    await authApi.requestPasswordReset(identifier, 'sms');
  } else {
    await authApi.requestOtp('sms', purpose);
  }
  code.value = '';
  errorMessage.value = '';
  attemptsRemaining.value = null;
  startCooldown();
}

async function onComplete(value: string) {
  if (value.length < 5) return;
  verifying.value = true;
  try {
    if (purpose === 'recovery') {
      // Verified together with the new password on AR3 — carry the code forward.
      router.replace({ name: redirectName, query: { identifier, code: value } });
      return;
    }
    await authApi.verifyOtp(value, purpose);
    if (purpose === 'member-link' && cruxId) {
      await auth.linkMembership(cruxId);
    }
    router.replace({ name: redirectName });
  } catch (e) {
    if (e instanceof ApiError) {
      errorMessage.value = e.message;
      attemptsRemaining.value = (e.meta?.attemptsRemaining as number) ?? null;
    } else {
      errorMessage.value = 'Something went wrong. Please try again.';
    }
    code.value = '';
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
