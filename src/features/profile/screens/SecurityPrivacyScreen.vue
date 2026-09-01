<template>
  <ion-page>
    <AppHeader title="Security and privacy" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <AppSectionLabel label="Signing in" />
        <AppCard style="padding: 0">
          <AppListRow
            title="Password"
            subtitle="Change it if you think someone else knows it"
            icon="password"
            chevron
            clickable
            @click="changePassword"
          />
          <!-- Kept as "Biometric unlock": the design writes "Face ID and
               fingerprint", but this build runs on Android as well and the
               plugin enrols whatever the device offers. -->
          <AppListRow title="Biometric unlock" subtitle="This device only" icon="fingerprint" :divider="false">
            <template #trailing>
              <label class="cc-toggle">
                <input type="checkbox" :checked="auth.user?.biometricEnabled" @change="onToggleBiometric" />
                <span class="cc-toggle__track"><span class="cc-toggle__thumb" /></span>
              </label>
            </template>
          </AppListRow>
        </AppCard>
        <p class="cc-text-caption">Off means password is required every time you open the app.</p>

        <AppSectionLabel label="Who sees what" />
        <AppCard style="padding: 0">
          <AppListRow
            title="Health profile access"
            :subtitle="healthAccessSubtitle"
            icon="medical_information"
            chevron
            clickable
            @click="router.push({ name: 'health-profile-access' })"
          />
          <AppListRow
            title="Location"
            :subtitle="locationSubtitle"
            icon="location_on"
            :icon-color="location.enabled ? 'var(--cc-color-primary)' : 'var(--cc-ink-400)'"
            :divider="false"
          >
            <template #trailing>
              <label class="cc-toggle">
                <input type="checkbox" :checked="location.enabled" @change="onToggleLocation" />
                <span class="cc-toggle__track"><span class="cc-toggle__thumb" /></span>
              </label>
            </template>
          </AppListRow>
        </AppCard>
        <p class="cc-text-caption">
          Off, the app stops keeping your location and forgets the last one. Therapists are then
          not filtered by distance.
        </p>

        <AppSectionLabel label="Activity" />
        <AppCard style="padding: 0">
          <AppListRow
            title="Active devices"
            subtitle="This device is signed in"
            icon="devices"
            :divider="false"
          />
        </AppCard>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { AppCard, AppHeader, AppListRow, AppSectionLabel } from '@/components/ui';
import { useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { healthAccessApi } from '@/api/health-access.api';
import { useAuthStore } from '@/stores/auth';
import { useLocationStore } from '@/stores/location';
import { formatCoordinates } from '@/services/deviceLocation';
import { biometric } from '@/services/biometric';
import { useToast } from '@/composables/useToast';

/** PR4 · Security and privacy — each toggle states what the off state means. */
const auth = useAuthStore();
const toast = useToast();
const router = useRouter();

/**
 * How many therapists can read the health profile right now.
 *
 * Counted from the real grants rather than from who is assigned: acceptance of
 * a care request lets a therapist ask, and only the client's answer gives them
 * access. Saying "access follows the booking" here was describing the rule the
 * platform used to have.
 */
const { data: accessRows } = useQuery({
  queryKey: ['health-profile', 'access'],
  queryFn: () => healthAccessApi.list(),
});

const healthAccessSubtitle = computed(() => {
  const rows = accessRows.value;
  if (!rows) return 'Only therapists you allow';

  const granted = rows.filter((r) => r.status === 'granted').length;
  const waiting = rows.filter((r) => r.status === 'pending').length;

  if (waiting > 0) {
    return `${waiting} waiting for your answer`;
  }

  if (granted === 0) return 'No one has access';
  return granted === 1 ? '1 therapist has access' : `${granted} therapists have access`;
});

/**
 * There is no in-app change-password route yet — only the signed-out reset
 * flow — so this sends them through that rather than opening a form that
 * cannot submit.
 */
async function changePassword() {
  await toast.show(
    'We will email you a link to set a new password. Use Forgot password on the sign-in screen, or contact support.',
    'info',
    { title: 'Changing your password' },
  );
}

const location = useLocationStore();
onMounted(() => location.hydrate());

const locationSubtitle = computed(() => {
  if (!location.enabled) return 'Off · therapists are not filtered by distance';
  if (location.busy) return 'Finding you…';
  if (location.error === 'unavailable') return 'On · could not read a position yet';
  if (location.coordinates) return `On · ${formatCoordinates(location.coordinates)}`;
  return 'On';
});

async function onToggleLocation(event: Event) {
  const wanted = (event.target as HTMLInputElement).checked;
  await location.setEnabled(wanted);

  // The OS can refuse after the app-level switch is flipped, in which case the
  // store turns itself back off — say why rather than letting it snap back.
  if (wanted && !location.enabled) {
    await toast.show(
      'Location is turned off for CruxCare in your device settings.',
      'warning',
      { title: 'Permission needed' },
    );
  }
}

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
