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
            <button
              type="button"
              class="cc-detail__action"
              @click="router.push({ name: 'change-contact', params: { field: 'email' } })"
            >
              Change
            </button>
          </div>

          <div class="cc-detail">
            <div class="cc-detail__body">
              <span class="cc-detail__label">Phone</span>
              <span class="cc-detail__value">{{ auth.user?.phone || 'Not recorded' }}</span>
            </div>
            <AppIcon name="verified" :size="20" color="var(--cc-color-primary)" />
            <button
              type="button"
              class="cc-detail__action"
              @click="router.push({ name: 'change-contact', params: { field: 'phone' } })"
            >
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

          <div class="cc-detail cc-detail--last">
            <div class="cc-detail__body">
              <span class="cc-detail__label">Crux ID</span>
              <span class="cc-detail__value cc-text-mono">{{ cruxId || 'Not issued' }}</span>
            </div>
            <span class="cc-detail__note">Permanent</span>
            <!-- Quoted to support and to an upline, so it is copied far more
                 often than it is read out. -->
            <button
              v-if="cruxId"
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
          <button
            type="button"
            class="cc-detail cc-detail--tappable"
            @click="router.push({ name: 'delivery-address' })"
          >
            <div class="cc-detail__body">
              <span class="cc-detail__label">Delivery address</span>
              <!-- Never invented: an account with no address says so rather
                   than showing a blank line that reads as a failed load. -->
              <span class="cc-detail__value">{{ addressLine ?? 'Add a delivery address' }}</span>
            </div>
            <AppIcon name="chevron_right" :size="20" color="var(--cc-ink-400)" />
          </button>

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

        <button type="button" class="cc-export" :disabled="exporting" @click="requestExport">
          <AppIcon name="download" :size="20" color="var(--cc-color-primary)" />
          <div class="cc-export__body">
            <div class="cc-text-body-strong" style="font-size: 14.5px">Download my data</div>
            <div class="cc-text-caption">Emailed as a zip within 48 hours</div>
          </div>
          <AppIcon name="chevron_right" :size="20" color="var(--cc-ink-400)" />
        </button>

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
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { copyToClipboard } from '@/services/clipboard';
import { securityApi } from '@/api/security.api';
import { ApiError } from '@/types/api';
import { formatAddress } from '@/types/user';

/**
 * PR3 · Personal information — the verified fields, shown in place with their
 * verified state, and the data export sitting with the data it exports.
 *
 * The data export names the address it is going to, then the date. It is a
 * real promise again — there is a builder, a mailable and a scheduled command
 * behind it — but the address leads because that is the half a member can act
 * on if it is wrong.
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
const router = useRouter();
const toast = useToast();

const username = computed(() => auth.user?.username ?? '');
/**
 * Read from the user object, not from `membership`.
 *
 * Every account carries a Crux ID from registration — all 1375 rows have one —
 * but `membership` is null for a plain client, so reading it there told people
 * who had had an id all along that they had none.
 */
const cruxId = computed(() => auth.user?.cruxId ?? auth.user?.membership?.cruxId ?? '');
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

const exporting = ref(false);

/** Asking twice returns the request already in flight rather than restarting
 *  the 48-hour promise, so a double tap is harmless. */
async function requestExport() {
  exporting.value = true;
  try {
    const { expectedBy } = await securityApi.requestDataExport();

    // The address is the half a member can act on, so it leads. `expectedBy`
    // is back alongside it now that a builder, a mailable and a scheduled
    // command actually stand behind it — it was dropped while the row was a
    // promise nothing kept.
    const to = auth.user?.email;
    const when = expectedBy ? new Date(expectedBy) : null;
    const by =
      when && !Number.isNaN(when.getTime())
        ? ` It should arrive by ${when.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}.`
        : '';

    await toast.show(
      `${to ? `We will email your data to ${to}.` : 'We will email your data to you.'}${by}`,
      'success',
      { title: 'Export requested' },
    );
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'We could not request your data. Check your connection and try again.';
    await toast.show(message, 'danger', { title: 'Not requested' });
  } finally {
    exporting.value = false;
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
.cc-detail--tappable {
  width: 100%;
  border-left: none;
  border-right: none;
  border-top: none;
  background: none;
  text-align: left;
  cursor: pointer;
  font: inherit;
}
.cc-detail--tappable:focus-visible {
  outline: 3px solid rgba(14, 124, 107, 0.35);
  outline-offset: -3px;
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
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-lg);
  background: var(--cc-surface-0);
  text-align: left;
  cursor: pointer;
}
.cc-export:focus-visible {
  outline: 3px solid rgba(14, 124, 107, 0.35);
  outline-offset: 2px;
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
