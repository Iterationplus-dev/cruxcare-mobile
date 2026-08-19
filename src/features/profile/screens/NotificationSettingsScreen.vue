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
          <p v-if="pushBlocked" class="cc-notice">
            Notifications are switched off for CruxCare in your device settings, so nothing below
            will be delivered until you turn them back on there.
          </p>

          <AppCard style="padding: 0">
            <AppListRow
              v-for="(pref, i) in preferences.required"
              :key="pref.key"
              :title="pref.label"
              subtitle="Required · security and money events"
              :divider="i !== preferences.required.length - 1"
            >
              <template #trailing><AppBadge label="ON" tone="success" /></template>
            </AppListRow>
          </AppCard>

          <div class="cc-text-body-strong" style="font-size: 14.5px">Optional</div>
          <AppCard style="padding: 0">
            <AppListRow
              v-for="(option, i) in optionalRows"
              :key="option.key"
              :title="option.label"
              :subtitle="preferences.optional[option.key] ? 'On' : 'Off'"
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

          <p v-if="preferences.quietHours" class="cc-text-caption">
            Quiet hours ({{ preferences.quietHours.start }}–{{ preferences.quietHours.end }})
            <template v-if="preferences.quietHours.allowTimeSensitive">
              still allow time-sensitive appointment reminders.
            </template>
            <template v-else>hold every optional notification until morning.</template>
          </p>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { AppBadge, AppButton, AppCard, AppHeader, AppListRow } from '@/components/ui';
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

const optionalRows: { key: OptionalNotificationCategory; label: string }[] = [
  { key: 'appointments', label: 'Appointment reminders' },
  { key: 'orders', label: 'Order updates' },
  { key: 'chat', label: 'Chat messages' },
  { key: 'marketing', label: 'Offers & announcements' },
];

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
