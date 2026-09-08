<template>
  <AppSheet v-model="open" title="Log out of CruxCare?">
    <p class="cc-text-body cc-logout__body">
      Nothing you have written is lost — session notes, receipts and drafts live on your
      account, not on this phone. Logging out only ends the session on this device.
    </p>

    <!-- AM4 draws an "unsent work" panel above this row. The app has no offline
         write queue (README: a deliberate non-feature), so there is never
         unsynced work to name and the panel would only ever state a fiction. -->

    <label v-if="otherDevices.length" class="cc-logout__devices">
      <span class="cc-logout__devices-body">
        <span class="cc-text-body-strong">Log out of all devices</span>
        <span class="cc-text-caption">{{ otherSessionsLabel }}</span>
      </span>
      <span class="cc-toggle">
        <input v-model="allDevices" type="checkbox" :disabled="busy" />
        <span class="cc-toggle__track"><span class="cc-toggle__thumb" /></span>
      </span>
    </label>

    <AppButton :loading="busy" style="margin-bottom: 9px" @click="onLogout">Log out</AppButton>
    <AppButton variant="text" :disabled="busy" @click="open = false">Stay logged in</AppButton>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQuery } from '@tanstack/vue-query';
import { AppButton, AppSheet } from '@/components/ui';
import { securityApi } from '@/api/security.api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';

/**
 * AM4 · Log out confirmation. One sheet for every profile screen — client and
 * therapist asked the same question in two slightly different wordings before.
 */
const open = defineModel<boolean>({ required: true });
const auth = useAuthStore();
const router = useRouter();
const toast = useToast();

const allDevices = ref(false);
const busy = ref(false);

// Only worth asking once the sheet is up; the list is shared with PR4's
// Active devices screen, so opening either warms the other.
const { data: devices } = useQuery({
  queryKey: ['me', 'devices'],
  queryFn: () => securityApi.devices(),
  enabled: computed(() => open.value),
});

const otherDevices = computed(() => (devices.value ?? []).filter((d) => !d.current));
const otherSessionsLabel = computed(() =>
  otherDevices.value.length === 1 ? '1 other session active' : `${otherDevices.value.length} other sessions active`,
);

watch(open, (isOpen) => {
  if (isOpen) allDevices.value = false;
});

async function onLogout() {
  if (busy.value) return;
  busy.value = true;

  // One call ends every session on the account, tokens and push registrations
  // together, so there is no half-signed-out state to recover from here.
  const endedEverywhere = allDevices.value && otherDevices.value.length > 0;
  let failure: string | ApiError | null = null;

  try {
    await auth.logout(endedEverywhere);
  } catch (error) {
    failure =
      error instanceof ApiError
        ? error
        : 'We could not reach the server, so your other devices may still be signed in.';
  } finally {
    // This phone is out either way — the session is cleared locally before the
    // call returns — so it leaves for the login screen regardless.
    busy.value = false;
    open.value = false;
    router.replace({ name: 'login' });
  }

  // Only worth raising when they asked for more than this handset: a failed
  // call that ends one session still ended the one they were holding.
  if (failure && endedEverywhere) {
    await toast.show(failure, 'warning', { title: 'Other devices may still be signed in' });
  }
}
</script>

<style scoped>
.cc-logout__body {
  margin: 0 0 16px;
}
.cc-logout__devices {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 13px;
  margin-bottom: 16px;
  border: 1px solid var(--cc-line);
  border-radius: 14px;
  background: var(--cc-surface-app);
  cursor: pointer;
}
.cc-logout__devices-body {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 2px;
}
.cc-toggle {
  position: relative;
  display: inline-block;
  flex: none;
  width: 42px;
  height: 25px;
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
  width: 42px;
  height: 25px;
  border-radius: var(--cc-radius-pill);
  background: var(--cc-line);
  padding: 3px;
  box-sizing: border-box;
}
.cc-toggle__thumb {
  display: block;
  width: 19px;
  height: 19px;
  border-radius: var(--cc-radius-pill);
  background: #fff;
  transition: transform var(--cc-motion-fast) var(--cc-ease-out);
}
.cc-toggle input:checked + .cc-toggle__track {
  background: var(--cc-color-primary);
}
.cc-toggle input:checked + .cc-toggle__track .cc-toggle__thumb {
  transform: translateX(17px);
}
</style>
