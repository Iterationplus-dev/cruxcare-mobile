<template>
  <ion-page>
    <AppHeader title="Active devices" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <LoadingState v-if="isPending" label="Loading your devices…" />

        <ErrorState
          v-else-if="isError"
          title="We could not load your devices"
          message="Nothing has been changed. Check your connection and try again."
        >
          <template #actions>
            <AppButton variant="secondary" @click="refetch()">Try again</AppButton>
          </template>
        </ErrorState>

        <template v-else>
          <p class="cc-devices__intro">
            Every device your account is signed in on. Signing one out revokes its access
            immediately — it is not a note in a list.
          </p>

          <AppCard style="padding: 0">
            <AppListRow
              v-for="(device, i) in rows"
              :key="device.id"
              :title="friendlyDeviceName(device.name)"
              :subtitle="subtitleFor(device)"
              icon="devices"
              :divider="i !== rows.length - 1"
            >
              <template #trailing>
                <AppBadge v-if="device.current" label="THIS DEVICE" tone="success" />
                <button
                  v-else
                  type="button"
                  class="cc-devices__sign-out"
                  :disabled="busyId === device.id"
                  @click="signOut(device)"
                >
                  Sign out
                </button>
              </template>
            </AppListRow>
          </AppCard>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { AppBadge, AppButton, AppCard, AppHeader, AppListRow } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/state';
import { securityApi, type ActiveDevice } from '@/api/security.api';
import { friendlyDeviceName } from '@/features/profile/deviceName';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';

/**
 * Where PR4's Active devices row leads.
 *
 * The list is projected from the tokens that actually grant access, so what is
 * shown here and what can reach the account cannot disagree.
 */
const toast = useToast();
const queryClient = useQueryClient();
const busyId = ref<string | null>(null);

const {
  data: devices,
  isPending,
  isError,
  refetch,
} = useQuery({
  queryKey: ['me', 'devices'],
  queryFn: () => securityApi.devices(),
});

const rows = computed(() => devices.value ?? []);

function subtitleFor(device: ActiveDevice): string {
  if (device.current) return 'The phone you are holding';
  if (!device.lastSeenAt) return 'Never used since signing in';

  const at = new Date(device.lastSeenAt);
  if (Number.isNaN(at.getTime())) return 'Last seen at an unknown time';
  return `Last seen ${at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

async function signOut(device: ActiveDevice) {
  busyId.value = device.id;
  try {
    await securityApi.forgetDevice(device.id);
    await queryClient.invalidateQueries({ queryKey: ['me', 'devices'] });
    await toast.show(`${friendlyDeviceName(device.name)} has been signed out.`, 'success');
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'We could not sign that device out. Please try again.';
    await toast.show(message, 'danger', { title: 'Not signed out' });
  } finally {
    busyId.value = null;
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
.cc-devices__intro {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cc-ink-600);
}
.cc-devices__sign-out {
  min-height: 44px;
  padding: 0 4px;
  border: none;
  background: none;
  color: var(--cc-color-danger);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
</style>
