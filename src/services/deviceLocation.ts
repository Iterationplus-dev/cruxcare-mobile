import { Geolocation } from '@capacitor/geolocation';

/**
 * The device's current position.
 *
 * Only ever called from an explicit tap. Location is a permission a person
 * grants for a reason, so nothing here runs on page load — the user asks, and
 * the prompt follows.
 */
export interface DeviceCoordinates {
  latitude: number;
  longitude: number;
  /** Metres. Useful for deciding whether a fix is worth keeping. */
  accuracy: number | null;
}

export type LocationOutcome =
  | { ok: true; coordinates: DeviceCoordinates }
  | { ok: false; reason: 'denied' | 'unavailable' };

/**
 * Asks for permission if it has not been given, then reads one fix.
 *
 * A refusal and a failure are told apart because they need different words: one
 * is a choice to respect, the other is something that might work next time.
 */
export async function readDeviceLocation(): Promise<LocationOutcome> {
  try {
    const status = await Geolocation.checkPermissions();

    if (status.location === 'denied') {
      return { ok: false, reason: 'denied' };
    }

    if (status.location !== 'granted') {
      const asked = await Geolocation.requestPermissions();
      if (asked.location !== 'granted') return { ok: false, reason: 'denied' };
    }

    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: false,
      timeout: 10_000,
    });

    return {
      ok: true,
      coordinates: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy ?? null,
      },
    };
  } catch {
    // No GPS, no browser support, a timeout, or the user dismissing the
    // system prompt — none of which is worth distinguishing to a person.
    return { ok: false, reason: 'unavailable' };
  }
}

/** "6.4550, 3.3841" — shown so someone can see the fix was taken, without
 *  implying more precision than a rounded pair carries. */
export function formatCoordinates(coordinates: DeviceCoordinates): string {
  return `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`;
}
