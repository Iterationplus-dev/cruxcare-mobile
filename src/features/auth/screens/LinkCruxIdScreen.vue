<template>
  <ion-page>
    <ion-header class="cc-plain-header">
      <ion-toolbar class="cc-plain-header__bar">
        <ion-buttons slot="start"><ion-back-button default-href="/profile" text="" /></ion-buttons>
        <ion-title>{{ forTherapist ? 'Verification · step 1 of 2' : 'Link Crux ID' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <div class="cc-progress-track" v-if="forTherapist"><div class="cc-progress-fill" style="width: 50%" /></div>
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <h2 class="cc-text-h1" style="margin: 0 0 6px">Verify your Crux ID</h2>
        <p class="cc-text-body" style="margin: 0 0 18px; font-size: 12.5px">
          Start from your member profile — no second account. Confirm the Crux ID you already hold, then we
          send a code to the record on file.
        </p>

        <AppInput v-model="cruxId" label="Crux ID" placeholder="CCI8804XO" helper="Format CCI####XX · printed on your member card" />

        <AppCard v-if="cruxId.length >= 9">
          <div class="cc-match">
            <AppIcon name="check_circle" :size="20" color="var(--cc-color-success)" />
            <span class="cc-text-body-strong" style="font-size: 13.5px">Match found</span>
          </div>
          <div class="cc-match-row"><span class="cc-text-caption">Name on record</span><span class="cc-text-body-strong" style="font-size: 12.5px">{{ auth.user ? `${auth.user.firstName} ${auth.user.lastName}` : '' }}</span></div>
        </AppCard>

        <AppCard>
          <div class="cc-text-body-strong" style="font-size: 13.5px; margin-bottom: 10px">We'll send a code to</div>
          <div class="cc-channels">
            <button
              v-for="c in channels"
              :key="c.key"
              type="button"
              class="cc-channel-row"
              :class="{ 'cc-channel-row--selected': channel === c.key }"
              @click="channel = c.key"
            >
              <AppIcon :name="c.icon" :size="22" :color="channel === c.key ? 'var(--cc-color-primary)' : 'var(--cc-ink-600)'" />
              <div class="cc-channel-row__body">
                <div class="cc-text-body-strong" style="font-size: 13.5px">{{ c.label }}</div>
                <div class="cc-text-mono" style="font-size: 12.5px; color: var(--cc-ink-400)">{{ c.masked }}</div>
              </div>
            </button>
          </div>
        </AppCard>
      </div>
      <div class="cc-screen__footer">
        <AppButton :disabled="cruxId.length < 9" :loading="submitting" @click="onSend">Send code</AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppButton, AppCard, AppIcon, AppInput } from '@/components/ui';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const toast = useToast();
const forTherapist = route.query.forTherapist === 'true';

// A signed-in member already holds a Crux ID, so start from it rather than
// making them type it again. The user can still be hydrating on a cold start,
// so fill it in when it arrives — but never over something they have typed.
const accountCruxId = computed(() => auth.user?.cruxId ?? auth.user?.membership?.cruxId ?? '');
const cruxId = ref(accountCruxId.value);
watch(accountCruxId, (value) => {
  if (value && !cruxId.value) cruxId.value = value;
});
const submitting = ref(false);

/**
 * WhatsApp and SMS reach the same number, so both appear only when the account
 * has one (handoff §19) — `phone` was sliced unguarded before, which threw for
 * an account without it.
 */
const phone = auth.user?.phone;
const maskedPhone = phone ? `••• ${phone.slice(-4)}` : '';
const channels = [
  ...(phone
    ? [
        { key: 'whatsapp' as const, icon: 'chat', label: 'WhatsApp', masked: maskedPhone },
        { key: 'sms' as const, icon: 'sms', label: 'SMS', masked: maskedPhone },
      ]
    : []),
  { key: 'email' as const, icon: 'mail', label: 'Email', masked: auth.user?.email ?? '' },
];
const channel = ref<'whatsapp' | 'sms' | 'email'>(channels[0].key);

async function onSend() {
  submitting.value = true;
  try {
    const delivery = await authApi.requestOtp(channel.value, 'member-link', cruxId.value.trim());
    router.push({
      name: 'register-otp',
      query: {
        purpose: 'member-link',
        contact: delivery.destination ?? channels.find((c) => c.key === channel.value)?.masked,
        channel: channel.value,
        resendAvailableAt: delivery.resendAvailableAt,
        expiresAt: delivery.expiresAt,
        sent: 'true',
        redirect: forTherapist ? 'therapist-plan' : 'client-settings',
        cruxId: cruxId.value.trim(),
      },
    });
  } catch (e) {
    // Without this a rejected request just stopped the spinner, and the
    // button looked like it did nothing.
    const message = e instanceof ApiError ? e.message : 'We could not send a code. Please try again.';
    await toast.show(message, 'danger', { title: 'Could not send code' });
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
.cc-progress-track {
  height: 5px;
  border-radius: 999px;
  background: var(--cc-color-mist);
  margin: 0 16px 14px;
}
.cc-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--cc-color-primary);
}
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cc-match {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}
.cc-match-row {
  display: flex;
  justify-content: space-between;
}
.cc-channels {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cc-channel-row {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 11px 13px;
  border: 1px solid var(--cc-line);
  border-radius: 12px;
  background: var(--cc-surface-0);
  cursor: pointer;
  text-align: left;
}
.cc-channel-row--selected {
  border: 1.5px solid var(--cc-color-primary);
  background: var(--cc-color-mist);
}
.cc-channel-row__body {
  flex: 1;
}
.cc-screen__footer {
  padding: 11px 16px calc(25px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
</style>
