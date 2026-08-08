<template>
  <ion-page>
    <AppHeader title="Security and privacy" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <AppCard style="padding: 0">
          <AppListRow title="Biometric unlock" icon="fingerprint" :divider="false">
            <template #trailing>
              <label class="cc-toggle">
                <input type="checkbox" :checked="auth.user?.biometricEnabled" @change="onToggleBiometric" />
                <span class="cc-toggle__track"><span class="cc-toggle__thumb" /></span>
              </label>
            </template>
          </AppListRow>
        </AppCard>
        <p class="cc-text-caption">Off means password is required every time you open the app.</p>

        <AppCard style="padding: 0">
          <AppListRow title="Active devices" subtitle="This device is one of them" icon="devices" :divider="false">
            <template #trailing><span class="cc-text-mono">1</span></template>
          </AppListRow>
        </AppCard>

        <div class="cc-text-body-strong" style="font-size: 14px">Who can see your health data</div>
        <AppCard style="padding: 0">
          <AppListRow
            v-if="assignedTherapist"
            :title="assignedTherapist.name"
            subtitle="Your assigned therapist · access follows the booking"
            icon="medical_information"
            :divider="false"
          />
          <AppListRow v-else title="No one yet" subtitle="Access is granted once a therapist is assigned" icon="medical_information" :divider="false" />
        </AppCard>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { AppCard, AppHeader, AppListRow } from '@/components/ui';
import { useCaseFiles } from '@/composables/useCaseFiles';
import { useTherapist } from '@/composables/useTherapists';
import { useAuthStore } from '@/stores/auth';
import { biometric } from '@/services/biometric';
import { useToast } from '@/composables/useToast';

/** PR4 · Security and privacy — each toggle states what the off state means. */
const auth = useAuthStore();
const toast = useToast();

const { data: caseFiles } = useCaseFiles();
const myCaseFile = computed(() => caseFiles.value?.data.find((cf) => cf.clientId === auth.user?.id));
const { data: assignedTherapist } = useTherapist(
  computed(() => myCaseFile.value?.therapistId ?? ''),
);

async function onToggleBiometric(e: Event) {
  const enabled = (e.target as HTMLInputElement).checked;
  if (enabled) {
    const ok = await biometric.verify('Confirm to enable biometric login');
    if (!ok) return;
    await auth.enableBiometric();
    await biometric.markEnabledOnDevice();
  } else if (auth.user) {
    auth.user.biometricEnabled = false;
  }
  await toast.show(enabled ? 'Biometric unlock turned on' : 'Biometric unlock turned off', 'success');
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
  transition: background var(--cc-motion-fast) var(--cc-ease-out);
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
