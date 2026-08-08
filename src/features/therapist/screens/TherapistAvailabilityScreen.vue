<template>
  <ion-page>
    <AppHeader title="Availability" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <p class="cc-text-body" style="font-size: 12px">
          Toggle the days you're bookable. Pausing a day hides new requests without cancelling what's already confirmed.
        </p>
        <AppCard style="padding: 0">
          <AppListRow v-for="d in days" :key="d.key" :title="d.label" :divider="d !== days[days.length - 1]">
            <template #trailing>
              <label class="cc-toggle">
                <input type="checkbox" v-model="d.enabled" />
                <span class="cc-toggle__track"><span class="cc-toggle__thumb" /></span>
              </label>
            </template>
          </AppListRow>
        </AppCard>
        <p class="cc-text-caption">Per-slot hours and booking rules ship with the full Availability module (TD3).</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { AppCard, AppHeader, AppListRow } from '@/components/ui';

const days = reactive([
  { key: 'mon', label: 'Monday', enabled: true },
  { key: 'tue', label: 'Tuesday', enabled: true },
  { key: 'wed', label: 'Wednesday', enabled: true },
  { key: 'thu', label: 'Thursday', enabled: true },
  { key: 'fri', label: 'Friday', enabled: true },
  { key: 'sat', label: 'Saturday', enabled: false },
  { key: 'sun', label: 'Sunday', enabled: false },
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
  gap: 12px;
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
