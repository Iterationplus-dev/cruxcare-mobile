import { ref } from 'vue';
import { defineStore } from 'pinia';
import { Network } from '@capacitor/network';

/**
 * Drives N3 (offline banner) and the money-writes-disabled rule everywhere
 * a money action button reads `online`. Never queues writes for later —
 * per README, that's a deliberate non-feature.
 */
export const useConnectivityStore = defineStore('connectivity', () => {
  const online = ref(true);
  const lastOnlineAt = ref<string>(new Date().toISOString());
  let unsubscribe: (() => void) | null = null;

  async function init() {
    const status = await Network.getStatus();
    online.value = status.connected;

    const listener = await Network.addListener('networkStatusChange', (status) => {
      online.value = status.connected;
      if (status.connected) lastOnlineAt.value = new Date().toISOString();
    });
    unsubscribe = () => void listener.remove();
  }

  function dispose() {
    unsubscribe?.();
  }

  return { online, lastOnlineAt, init, dispose };
});
