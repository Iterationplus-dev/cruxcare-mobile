<template>
  <ion-page>
    <AppHeader title="Personal information" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <AppSectionLabel label="Verified details" />
        <AppCard style="padding: 0">
          <div class="cc-detail">
            <div class="cc-detail__body">
              <span class="cc-detail__label">Email</span>
              <span class="cc-detail__value">{{ auth.user?.email }}</span>
            </div>
            <AppIcon
              v-if="auth.user?.emailVerified !== false"
              name="verified"
              :size="20"
              color="var(--cc-color-primary)"
            />
            <button type="button" class="cc-detail__action" @click="notYet('email address')">
              Change
            </button>
          </div>

          <div class="cc-detail">
            <div class="cc-detail__body">
              <span class="cc-detail__label">Phone</span>
              <span class="cc-detail__value">{{ auth.user?.phone || 'Not recorded' }}</span>
            </div>
            <AppIcon name="verified" :size="20" color="var(--cc-color-primary)" />
            <button type="button" class="cc-detail__action" @click="notYet('phone number')">
              Change
            </button>
          </div>

          <!-- The handle people sign in with. It belongs among the verified
               details because a shared email address is refused and the member
               is told to use this instead — so it has to be findable, and
               copyable rather than retyped from memory. -->
          <div v-if="username" class="cc-detail">
            <div class="cc-detail__body">
              <span class="cc-detail__label">Username</span>
              <span class="cc-detail__value cc-text-mono">{{ username }}</span>
            </div>
            <button
              type="button"
              class="cc-detail__action"
              :aria-label="`Copy your username, ${username}`"
              @click="copyValue('username', username, 'Username')"
            >
              {{ copiedField === 'username' ? 'Copied' : 'Copy' }}
            </button>
          </div>

          <div v-if="cruxId" class="cc-detail cc-detail--last">
            <div class="cc-detail__body">
              <span class="cc-detail__label">Crux ID</span>
              <span class="cc-detail__value cc-text-mono">{{ cruxId }}</span>
            </div>
            <span class="cc-detail__note">Permanent</span>
            <!-- Quoted to support and to an upline, so it is copied far more
                 often than it is read out. -->
            <button
              type="button"
              class="cc-detail__action"
              :aria-label="`Copy your Crux ID, ${cruxId}`"
              @click="copyValue('cruxId', cruxId, 'Crux ID')"
            >
              {{ copiedField === 'cruxId' ? 'Copied' : 'Copy' }}
            </button>
          </div>
        </AppCard>

        <AppSectionLabel label="Address and identity" />
        <AppCard style="padding: 0">
          <div class="cc-detail">
            <div class="cc-detail__body">
              <span class="cc-detail__label">Delivery address</span>
              <!-- Never invented: an account with no address says so rather
                   than showing a blank line that reads as a failed load. -->
              <span class="cc-detail__value">{{ addressLine ?? 'Not recorded yet' }}</span>
            </div>
            <AppIcon name="chevron_right" :size="20" color="var(--cc-ink-400)" />
          </div>

          <!-- Drawn in PR3 with a verified NIN. There is no identity document
               anywhere in the API, so this states that plainly instead of
               showing a document nobody has uploaded. -->
          <div class="cc-detail cc-detail--last cc-detail--muted">
            <div class="cc-detail__body">
              <span class="cc-detail__label">Identity document</span>
              <span class="cc-detail__value">NIN or passport verification</span>
            </div>
            <span class="cc-detail__soon">Coming soon</span>
          </div>
        </AppCard>

        <AppCard class="cc-export">
          <AppIcon name="download" :size="20" color="var(--cc-color-primary)" />
          <div class="cc-export__body">
            <div class="cc-text-body-strong" style="font-size: 14.5px">Download my data</div>
            <div class="cc-text-caption">Emailed as a zip within 48 hours</div>
          </div>
          <AppIcon name="chevron_right" :size="20" color="var(--cc-ink-400)" />
        </AppCard>

        <div class="cc-notice">
          <AppIcon name="info" :size="18" color="var(--cc-color-primary)" />
          <p>Changing email or phone needs a code sent to the current one first.</p>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { AppCard, AppHeader, AppIcon, AppSectionLabel } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { copyToClipboard } from '@/services/clipboard';
import { formatAddress } from '@/types/user';

/**
 * PR3 · Personal information — the verified fields, shown in place with their
 * verified state, and the data export sitting with the data it exports.
 *
 * Everything editable moved to PR2 (Edit profile). That separation is the
 * design's argument: a field that needs a code to change should not sit in a
 * form beside one that does not.
 *
 * Next of kin is drawn here too and has no field behind it, so it is not
 * shown at all. Identity document has none either, but is named as coming soon
 * rather than omitted — the difference is that verification is a thing the
 * member will be asked for, so knowing it is on the way is useful; a blank
 * next-of-kin row would just claim the platform holds something it does not.
 */
const auth = useAuthStore();
const toast = useToast();

const username = computed(() => auth.user?.username ?? '');
const cruxId = computed(() => auth.user?.membership?.cruxId ?? '');
const addressLine = computed(() => formatAddress(auth.user?.address));
/** Which row last reported a successful copy, so two Copy buttons cannot both
 *  read "Copied" at once. */
const copiedField = ref<string | null>(null);

async function copyValue(field: string, value: string, label: string) {
  if (!value) return;

  if (await copyToClipboard(value)) {
    copiedField.value = field;
    setTimeout(() => {
      if (copiedField.value === field) copiedField.value = null;
    }, 2000);
    await toast.show(`${label} copied`, 'success');
    return;
  }

  // Never claim a copy that did not happen — the value is on screen and can
  // still be read off it.
  await toast.show(`Couldn't copy. Your ${label.toLowerCase()} is ${value}`, 'warning');
}

/**
 * The change flows need an OTP round trip the API does not expose yet. Saying
 * so beats a control that looks live and does nothing.
 */
async function notYet(what: string) {
  await toast.show(
    `Changing your ${what} needs a verification code, which is not built yet. Contact support from Help and support and they will change it for you.`,
    'info',
    { title: 'Not available yet' },
  );
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
  gap: 10px;
}
.cc-detail {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--cc-line);
}
.cc-detail--last {
  border-bottom: none;
}
.cc-detail__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cc-detail__label {
  font-size: 12px;
  color: var(--cc-ink-400);
}
.cc-detail__value {
  font-size: 14.5px;
  color: var(--cc-ink-900);
  overflow-wrap: anywhere;
}
.cc-detail__action {
  flex: none;
  min-height: 44px;
  padding: 0 4px;
  border: none;
  background: none;
  color: var(--cc-color-primary);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.cc-detail--muted .cc-detail__value {
  color: var(--cc-ink-400);
}
.cc-detail__soon {
  flex: none;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--cc-color-mist);
  color: var(--cc-ink-600);
  font-size: 11.5px;
  font-weight: 600;
}
.cc-detail__note {
  flex: none;
  font-size: 12.5px;
  color: var(--cc-ink-400);
}
.cc-export {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cc-export__body {
  flex: 1;
}
.cc-notice {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 14px;
  border-radius: var(--cc-radius-lg);
  background: var(--cc-color-mist);
}
.cc-notice p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cc-ink-700);
}
</style>
