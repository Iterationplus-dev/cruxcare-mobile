<template>
  <ion-page>
    <AppHeader title="Notifications" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <AppCard style="padding: 0">
          <AppListRow
            v-for="pref in required"
            :key="pref.key"
            :title="pref.label"
            subtitle="Required · security and money events"
            :divider="pref !== required[required.length - 1]"
          >
            <template #trailing><AppBadge label="ON" tone="success" /></template>
          </AppListRow>
        </AppCard>

        <div class="cc-text-body-strong" style="font-size: 14.5px">Optional</div>
        <AppCard style="padding: 0">
          <AppListRow
            v-for="(pref, i) in optional"
            :key="pref.key"
            :title="pref.label"
            :subtitle="pref.enabled ? 'On' : 'Off'"
            :divider="i !== optional.length - 1"
          >
            <template #trailing>
              <label class="cc-toggle">
                <input type="checkbox" v-model="pref.enabled" />
                <span class="cc-toggle__track"><span class="cc-toggle__thumb" /></span>
              </label>
            </template>
          </AppListRow>
        </AppCard>
        <p class="cc-text-caption">Quiet hours (10pm-7am) still allow time-sensitive appointment reminders.</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { AppBadge, AppCard, AppHeader, AppListRow } from '@/components/ui';

/** PR5 · Notification settings — required vs optional split honestly.
 * Preferences are local-only until a /notifications/prefs endpoint exists. */
const required = [
  { key: 'security', label: 'Security alerts' },
  { key: 'money', label: 'Money & wallet activity' },
];

const optional = reactive([
  { key: 'appointments', label: 'Appointment reminders', enabled: true },
  { key: 'orders', label: 'Order updates', enabled: true },
  { key: 'chat', label: 'Chat messages', enabled: true },
  { key: 'marketing', label: 'Offers & announcements', enabled: false },
]);
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
