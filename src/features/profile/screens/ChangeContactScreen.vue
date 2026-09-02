<template>
  <ion-page>
    <AppHeader :title="isEmail ? 'Change email' : 'Change phone'" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <!-- Step one: what it is being changed to. -->
        <template v-if="!challenge">
          <p class="cc-change__intro">
            {{
              isEmail
                ? 'Enter the new email address. We will send a code to your current one to confirm it is you.'
                : 'Enter the new phone number. We will send a code to your current one to confirm it is you.'
            }}
          </p>

          <div class="cc-change__current">
            <span class="cc-change__current-label">{{ isEmail ? 'Current email' : 'Current phone' }}</span>
            <span class="cc-change__current-value">{{ currentValue || 'Not recorded' }}</span>
          </div>

          <AppInput
            v-model="value"
            :label="isEmail ? 'New email address' : 'New phone number'"
            :type="isEmail ? 'email' : 'tel'"
            :inputmode="isEmail ? 'email' : 'tel'"
            :placeholder="isEmail ? 'you@example.com' : '+234 803 000 0000'"
            :error="valueError"
            autocomplete="off"
          />

          <AppSheetSelect
            v-if="!isEmail"
            v-model="channel"
            label="Send the code by"
            title="Send the code by"
            :options="channelOptions"
          />

          <div class="cc-change__note">
            <AppIcon name="lock" :size="18" color="var(--cc-ink-600)" />
            <p>
              The code goes to your current {{ isEmail ? 'address' : 'number' }}, not the new one —
              so nobody who has taken your session can move the account somewhere you cannot reach.
            </p>
          </div>
        </template>

        <!-- Step two: the code. -->
        <template v-else>
          <p class="cc-change__intro">
            We sent a code to <strong>{{ challenge.destination || 'your current contact' }}</strong>.
            Enter it to move your {{ isEmail ? 'email' : 'phone' }} to
            <strong>{{ value }}</strong>.
          </p>

          <OtpInput v-model="code" :length="5" :error="codeError" />

          <button type="button" class="cc-change__restart" @click="restart">
            Use a different {{ isEmail ? 'address' : 'number' }}
          </button>
        </template>
      </div>

      <div class="cc-screen__footer">
        <AppButton :loading="busy" :disabled="!canSubmit" @click="onSubmit">
          {{ challenge ? 'Confirm the change' : 'Send the code' }}
        </AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppButton, AppHeader, AppIcon, AppInput, AppSheetSelect, OtpInput } from '@/components/ui';
import { authApi, type ContactChangeChallenge } from '@/api/auth.api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';

/**
 * Changing a verified contact, in the two steps the server requires.
 *
 * One screen for both because the flow is identical — enter the new value, then
 * a code sent to the *old* one. Splitting it would have been two screens
 * differing only in a label.
 */
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const toast = useToast();

const isEmail = computed(() => route.params.field !== 'phone');

const value = ref('');
const code = ref('');
const channel = ref<'sms' | 'whatsapp'>('sms');
const channelOptions = [
  { value: 'sms', label: 'SMS' },
  { value: 'whatsapp', label: 'WhatsApp' },
];

/** Set once the server has sent a code; its presence is what moves the screen
 *  to step two, so a failed send never strands anyone on the code entry. */
const challenge = ref<ContactChangeChallenge | null>(null);
const busy = ref(false);
const touched = ref(false);
const codeError = ref('');

const currentValue = computed(() => (isEmail.value ? auth.user?.email : auth.user?.phone) ?? '');

const valueError = computed(() => {
  if (!touched.value || !value.value) return '';
  if (isEmail.value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.value.trim())
      ? ''
      : 'That does not look like an email address.';
  }
  return /^\+?[0-9]{7,15}$/.test(value.value.replace(/[\s-]/g, ''))
    ? ''
    : 'Enter a phone number with 7 to 15 digits.';
});

const canSubmit = computed(() => {
  if (challenge.value) return code.value.length === 5;
  return !!value.value.trim() && !valueError.value;
});

function normalised(): string {
  return isEmail.value ? value.value.trim().toLowerCase() : value.value.replace(/[\s-]/g, '');
}

/** Back to step one, dropping the code. The old challenge is dead once the
 *  target changes, so keeping it would confirm a value nobody asked for. */
function restart() {
  challenge.value = null;
  code.value = '';
  codeError.value = '';
}

async function onSubmit() {
  touched.value = true;
  if (!canSubmit.value) return;

  busy.value = true;
  try {
    if (!challenge.value) {
      challenge.value = isEmail.value
        ? await authApi.requestEmailChange(normalised())
        : await authApi.requestPhoneChange(normalised(), channel.value);
      return;
    }

    const updated = isEmail.value
      ? await authApi.confirmEmailChange(normalised(), code.value)
      : await authApi.confirmPhoneChange(normalised(), code.value);

    auth.user = updated;
    await toast.show(
      isEmail.value ? 'Your email address is updated.' : 'Your phone number is updated.',
      'success',
    );
    router.back();
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'Something went wrong. Check your connection and try again.';

    // A rejected code belongs against the code field; anything else is about
    // the change as a whole and is said once, loudly.
    if (challenge.value && error instanceof ApiError && error.status === 422) {
      codeError.value = message;
    } else {
      await toast.show(message, 'danger', { title: 'Not changed' });
    }
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cc-screen__footer {
  position: sticky;
  bottom: 0;
  padding: 12px 16px calc(12px + var(--ion-safe-area-bottom, 0px));
  background: var(--cc-surface-app);
  border-top: 1px solid var(--cc-line);
}
.cc-change__intro {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--cc-ink-600);
}
.cc-change__current {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px 14px;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-lg);
  background: var(--cc-surface-0);
}
.cc-change__current-label {
  font-size: 12px;
  color: var(--cc-ink-400);
}
.cc-change__current-value {
  font-size: 14.5px;
  color: var(--cc-ink-900);
  overflow-wrap: anywhere;
}
.cc-change__note {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 14px;
  border-radius: var(--cc-radius-lg);
  background: var(--cc-color-mist);
}
.cc-change__note p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cc-ink-700);
}
.cc-change__restart {
  align-self: flex-start;
  min-height: 44px;
  border: none;
  background: none;
  color: var(--cc-color-primary);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
}
</style>
