<template>
  <ion-page>
    <ion-header class="cc-plain-header">
      <ion-toolbar class="cc-plain-header__bar">
        <ion-title />
      </ion-toolbar>
    </ion-header>
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <div class="cc-verified-pill">
          <AppIcon name="check_circle" :size="17" color="var(--cc-color-success-text)" />
          <span>Account verified</span>
        </div>
        <h2 class="cc-text-h1" style="margin: 0 0 6px">One step before a therapist</h2>
        <p class="cc-text-body" style="margin: 0 0 18px; font-size: 12.5px">
          A therapist can't safely advise without your history. A few short sections — you can shop and
          browse meanwhile.
        </p>

        <div class="cc-progress-row">
          <span class="cc-text-body" style="font-size: 12.5px">Health profile</span>
          <span class="cc-text-mono">{{ filledCount }} of {{ sections.length }}</span>
        </div>
        <div class="cc-progress"><div class="cc-progress__fill" :style="{ width: `${completion}%` }" /></div>

        <AppCard style="padding: 0">
          <AppListRow
            v-for="s in sections"
            :key="s.key"
            :title="s.label"
            :subtitle="s.value ? s.value : 'Required · takes about a minute'"
            :icon="s.value ? 'check_circle' : 'radio_button_unchecked'"
            :icon-color="s.value ? 'var(--cc-color-success)' : 'var(--cc-color-warning)'"
            chevron
            clickable
            @click="router.push({ name: 'health-profile' })"
          />
        </AppCard>

        <div class="cc-locked">
          <AppIcon name="lock" :size="20" color="var(--cc-ink-400)" />
          <div>
            <div class="cc-text-body-strong" style="font-size: 13.5px">Locked until this is done</div>
            <div class="cc-text-caption">Therapist discovery, booking, chat and video. Shop and wallet are open now.</div>
          </div>
        </div>
        <div class="cc-consent-note">
          <AppIcon name="shield_lock" :size="20" color="var(--cc-color-primary)" />
          <p>Encrypted, and visible only to the therapist you're matched with. You can withdraw consent any time.</p>
        </div>
      </div>
      <div class="cc-screen__footer">
        <AppButton style="margin-bottom: 9px" @click="router.push({ name: 'health-profile' })">Continue</AppButton>
        <AppButton variant="text" @click="router.replace({ name: 'tabs-home' })">Browse the shop first</AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppButton, AppCard, AppIcon, AppListRow } from '@/components/ui';
import { useHealthProfile } from '@/composables/useCaseFiles';
import type { HealthProfileSection } from '@/types/care';

/** A4 · Health profile gate — care is gated, commerce isn't. */
const router = useRouter();
const { data: profile } = useHealthProfile();

const defaults: HealthProfileSection[] = [
  { key: 'basics', label: 'Basics', value: null },
  { key: 'conditions', label: 'Conditions', value: null },
  { key: 'allergies', label: 'Allergies', value: null },
  { key: 'medications', label: 'Current medication', value: null },
];
const sections = computed(() => {
  const existing = profile.value?.sections ?? [];
  return defaults.map((d) => existing.find((e) => e.key === d.key) ?? d);
});
const filledCount = computed(() => sections.value.filter((s) => s.value).length);
const completion = computed(() => Math.round((filledCount.value / sections.value.length) * 100));
</script>

<style scoped>
.cc-plain-header {
  box-shadow: none;
}
.cc-plain-header__bar {
  --background: var(--cc-surface-0);
  --border-width: 0;
}
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-verified-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 13px;
  border-radius: 999px;
  background: rgba(46, 158, 91, 0.14);
  color: var(--cc-color-success-text);
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 11.5px;
  width: fit-content;
  margin-bottom: 4px;
}
.cc-progress-row {
  display: flex;
  justify-content: space-between;
}
.cc-progress {
  height: 7px;
  border-radius: 999px;
  background: var(--cc-divider);
}
.cc-progress__fill {
  height: 100%;
  border-radius: 999px;
  background: var(--cc-color-primary);
}
.cc-locked {
  display: flex;
  gap: 10px;
  padding: 13px 14px;
  border: 1px solid var(--cc-line);
  border-radius: 16px;
  background: var(--cc-surface-0);
}
.cc-consent-note {
  display: flex;
  gap: 10px;
  padding: 13px 14px;
  border-radius: 16px;
  background: var(--cc-color-mist);
}
.cc-consent-note p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 17px;
  color: var(--cc-ink-600);
}
.cc-screen__footer {
  padding: 11px 14px calc(25px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
</style>
