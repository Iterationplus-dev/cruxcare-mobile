import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { Preferences } from '@capacitor/preferences';
import { readDeviceLocation, type DeviceCoordinates } from '@/services/deviceLocation';

const ENABLED_KEY = 'cc_location_enabled';

/**
 * Whether the app keeps track of where the signed-in user is, and the last fix
 * it took.
 *
 * Off by default and never turned on for someone: location is a thing a person
 * grants, so nothing here reads a position until they have said yes. Turning it
 * off drops the stored fix as well as stopping new ones — leaving the last
 * known position behind would make "off" a lie.
 */
export const useLocationStore = defineStore('location', () => {
  const enabled = ref(false);
  const hydrated = ref(false);
  const coordinates = ref<DeviceCoordinates | null>(null);
  const updatedAt = ref<string | null>(null);
  const busy = ref(false);
  const error = ref<'denied' | 'unavailable' | null>(null);

  const hasFix = computed(() => coordinates.value !== null);

  /** Restores the preference — not the position. A fix from a previous session
   *  says where they were, not where they are. */
  async function hydrate() {
    if (hydrated.value) return;
    try {
      const stored = await Preferences.get({ key: ENABLED_KEY });
      enabled.value = stored.value === 'true';
    } catch {
      // No preferences store on web; the default of off is the safe one.
    }
    hydrated.value = true;
    if (enabled.value) await refresh();
  }

  /** Takes a fresh fix. Silent when switched off — callers can poll on resume
   *  without checking first. */
  async function refresh() {
    if (!enabled.value || busy.value) return;
    busy.value = true;
    error.value = null;
    try {
      const outcome = await readDeviceLocation();
      if (outcome.ok) {
        coordinates.value = outcome.coordinates;
        updatedAt.value = new Date().toISOString();
      } else {
        error.value = outcome.reason;
        // A refusal at the OS level overrides the app-level preference: the
        // toggle should not sit on while nothing can be read.
        if (outcome.reason === 'denied') await setEnabled(false);
      }
    } finally {
      busy.value = false;
    }
  }

  async function setEnabled(next: boolean) {
    enabled.value = next;
    try {
      await Preferences.set({ key: ENABLED_KEY, value: String(next) });
    } catch {
      // Preference not persisted; the session still honours the choice.
    }

    if (!next) {
      coordinates.value = null;
      updatedAt.value = null;
      error.value = null;
      return;
    }

    await refresh();
  }

  /** Clears everything on sign-out — one person's whereabouts must not survive
   *  into the next person's session on a shared device. */
  function reset() {
    coordinates.value = null;
    updatedAt.value = null;
    error.value = null;
  }

  return { enabled, hydrated, coordinates, updatedAt, busy, error, hasFix, hydrate, refresh, setEnabled, reset };
});
