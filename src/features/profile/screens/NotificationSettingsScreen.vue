<template>
  <ion-page>
    <AppHeader title="Notifications" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <LoadingState v-if="isPending" label="Loading your notification settings…" />

        <ErrorState
          v-else-if="isError || !preferences"
          title="We could not load your settings"
          message="Nothing has been changed. Check your connection and try again."
        >
          <template #actions>
            <AppButton variant="secondary" @click="refetch()">Try again</AppButton>
          </template>
        </ErrorState>

        <template v-else>
          <!-- PR5 draws this as a toggle. An app cannot grant itself OS
               notification permission, so it reports the state instead of
               offering a switch that could not move it. -->
          <AppCard style="padding: 0">
            <AppListRow
              title="Push notifications"
              :subtitle="pushBlocked ? 'Blocked in your device settings' : 'Allowed in your device settings'"
              icon="notifications_active"
              :icon-color="pushBlocked ? 'var(--cc-color-warning-text)' : 'var(--cc-color-primary)'"
              :subtitle-tone="pushBlocked ? 'warning' : 'default'"
              :divider="false"
            />
          </AppCard>
          <p v-if="pushBlocked" class="cc-notice">
            Notifications are switched off for CruxCare in your device settings, so nothing below
            will be delivered until you turn them back on there.
          </p>

          <AppSectionLabel label="Always sent" />
          <AppCard style="padding: 0">
            <AppListRow
              v-for="(pref, i) in preferences.required"
              :key="pref.key"
              :title="requiredLabel(pref)"
              :subtitle="requiredSubtitle(pref)"
              :divider="i !== preferences.required.length - 1"
            >
              <template #trailing><span class="cc-notify__required">Required</span></template>
            </AppListRow>
          </AppCard>

          <AppSectionLabel label="Your choice" />
          <AppCard style="padding: 0">
            <AppListRow
              v-for="(option, i) in optionalRows"
              :key="option.key"
              :title="option.label"
              :subtitle="option.hint"
              :divider="i !== optionalRows.length - 1"
            >
              <template #trailing>
                <label class="cc-toggle">
                  <input
                    type="checkbox"
                    :checked="preferences.optional[option.key]"
                    :disabled="isSaving"
                    @change="onToggle(option.key, $event)"
                  />
                  <span class="cc-toggle__track"><span class="cc-toggle__thumb" /></span>
                </label>
              </template>
            </AppListRow>
          </AppCard>

          <AppSectionLabel label="Quiet hours" />
          <AppCard style="padding: 0">
            <AppListRow
              title="Quiet hours"
              :subtitle="quietHoursSubtitle"
              icon="bedtime"
              :divider="false"
            />
          </AppCard>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { AppButton, AppCard, AppHeader, AppListRow, AppSectionLabel } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/state';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from '@/composables/useNotifications';
import { useToast } from '@/composables/useToast';
import { pushPermissionState } from '@/services/push/pushNotifications';
import type { OptionalNotificationCategory } from '@/types/push';

/**
 * PR5 · Notification settings — the required/optional split is enforced by the
 * API, not by this screen: `required` categories are absent from `optional`
 * entirely, so there is no toggle that could switch a security alert off.
 */
const toast = useToast();
const { data: preferences, isPending, isError, refetch } = useNotificationPreferences();
const update = useUpdateNotificationPreferences();
const isSaving = computed(() => update.isPending.value);

/**
 * PR5's wording, against the categories the API actually has.
 *
 * The design puts "Session reminders" under Always sent. The server does not:
 * `appointments` is optional there, and labelling an optional category
 * "Required" would tell someone they cannot switch off something they can. It
 * sits under Your choice with the design's own label.
 *
 * `cases` was missing from this screen entirely — a category the server has
 * always accepted with no way to reach it.
 *
 * "Savings and commitment nudges" and "Network and ranking changes" are drawn
 * but have no category behind them, so they are not shown.
 */
const optionalRows: { key: OptionalNotificationCategory; label: string; hint: string }[] = [
  { key: 'appointments', label: 'Session reminders', hint: '24 hours and 1 hour before' },
  { key: 'chat', label: 'Messages from therapists', hint: 'New messages in your conversations' },
  { key: 'orders', label: 'Order and delivery updates', hint: 'Dispatch, delivery and changes' },
  { key: 'cases', label: 'Care and treatment updates', hint: 'Notes, diagnoses and case changes' },
  { key: 'marketing', label: 'Offers and new products', hint: 'Occasional, never about your care' },
];

/** PR5's copy for the two the server marks required. */
const REQUIRED_COPY: Record<string, { label: string; hint: string }> = {
  money: { label: 'Money movement', hint: 'Payments, payouts, failed charges' },
  security: { label: 'Security alerts', hint: 'Sign-ins and changes to your account' },
};

function requiredLabel(pref: { key: string; label: string }): string {
  return REQUIRED_COPY[pref.key]?.label ?? pref.label;
}

function requiredSubtitle(pref: { key: string }): string {
  return REQUIRED_COPY[pref.key]?.hint ?? 'Security and money events';
}

const quietHoursSubtitle = computed(() => {
  const quiet = preferences.value?.quietHours;
  if (!quiet) return 'Not set · notifications arrive at any time';

  const window = `${quiet.start} to ${quiet.end}`;
  return quiet.allowTimeSensitive
    ? `${window} · reminders still arrive`
    : `${window} · everything optional waits until morning`;
});

/**
 * Per-category preferences are meaningless while the OS is blocking delivery,
 * and silently showing them all "On" would be a lie.
 */
const pushBlocked = computed(() => pushPermissionState.value === 'denied');

async function onToggle(key: OptionalNotificationCategory, event: Event) {
  const enabled = (event.target as HTMLInputElement).checked;
  try {
    // The checkbox is uncontrolled until the server answers, so a rejected
    // change snaps back rather than leaving the UI ahead of the truth.
    await update.mutateAsync({ optional: { [key]: enabled } as never });
  } catch {
    await refetch();
    await toast.show('That preference was not saved. Please try again.', 'danger');
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
.cc-notice {
  margin: 0;
  padding: 12px 14px;
  border-radius: var(--cc-radius-md);
  background: var(--cc-color-warning-surface, #fff6e5);
  color: var(--cc-color-warning-text, #7a4b00);
  font-size: 13.5px;
  line-height: 1.45;
}
.cc-toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 24px;
}
.cc-toggle input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
}
.cc-toggle input:disabled {
  cursor: progress;
}
.cc-toggle__track {
  display: block;
  width: 40px;
  height: 24px;
  border-radius: 999px;
  background: var(--cc-line);
  padding: 2px;
  box-sizing: border-box;
}
.cc-toggle__thumb {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: #fff;
  transition: transform var(--cc-motion-fast) var(--cc-ease-out);
}
.cc-toggle input:checked + .cc-toggle__track {
  background: var(--cc-color-primary);
}
.cc-toggle input:checked + .cc-toggle__track .cc-toggle__thumb {
  transform: translateX(16px);
}
</style>
