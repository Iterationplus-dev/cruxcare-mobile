import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const set = vi.fn();
const readDeviceLocation = vi.fn();

vi.mock('@capacitor/preferences', () => ({ Preferences: { get, set } }));
vi.mock('@/services/deviceLocation', () => ({
  readDeviceLocation,
  formatCoordinates: () => '0.0000, 0.0000',
}));

const { useLocationStore } = await import('@/stores/location');

const fix = { latitude: 6.455, longitude: 3.3841, accuracy: 10 };

describe('location preference', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    get.mockReset();
    set.mockReset();
    readDeviceLocation.mockReset();
    get.mockResolvedValue({ value: null });
    set.mockResolvedValue(undefined);
  });

  it('is off until the user turns it on', async () => {
    const store = useLocationStore();
    await store.hydrate();

    expect(store.enabled).toBe(false);
    // Nothing is read while off — no prompt appears uninvited.
    expect(readDeviceLocation).not.toHaveBeenCalled();
  });

  it('takes a fix when switched on, and remembers the choice', async () => {
    readDeviceLocation.mockResolvedValue({ ok: true, coordinates: fix });
    const store = useLocationStore();

    await store.setEnabled(true);

    expect(store.coordinates).toEqual(fix);
    expect(store.updatedAt).not.toBeNull();
    expect(set).toHaveBeenCalledWith({ key: 'cc_location_enabled', value: 'true' });
  });

  it('forgets the last position when switched off', async () => {
    readDeviceLocation.mockResolvedValue({ ok: true, coordinates: fix });
    const store = useLocationStore();
    await store.setEnabled(true);

    await store.setEnabled(false);

    // Keeping the last fix would make "off" a lie.
    expect(store.coordinates).toBeNull();
    expect(store.updatedAt).toBeNull();
  });

  it('turns itself off when the device refuses', async () => {
    readDeviceLocation.mockResolvedValue({ ok: false, reason: 'denied' });
    const store = useLocationStore();

    await store.setEnabled(true);

    // The toggle must not sit on while nothing can ever be read.
    expect(store.enabled).toBe(false);
  });

  it('stays on when a fix merely fails, which may work next time', async () => {
    readDeviceLocation.mockResolvedValue({ ok: false, reason: 'unavailable' });
    const store = useLocationStore();

    await store.setEnabled(true);

    expect(store.enabled).toBe(true);
    expect(store.error).toBe('unavailable');
  });

  it('restores the preference but not a stale position', async () => {
    get.mockResolvedValue({ value: 'true' });
    readDeviceLocation.mockResolvedValue({ ok: true, coordinates: fix });
    const store = useLocationStore();

    await store.hydrate();

    // A fix from a previous session says where they were, not where they are,
    // so hydrate re-reads rather than restoring one.
    expect(readDeviceLocation).toHaveBeenCalledOnce();
    expect(store.coordinates).toEqual(fix);
  });

  it('does nothing on refresh while off', async () => {
    const store = useLocationStore();
    await store.refresh();

    expect(readDeviceLocation).not.toHaveBeenCalled();
  });

  it('clears everything on reset, for a shared device', async () => {
    readDeviceLocation.mockResolvedValue({ ok: true, coordinates: fix });
    const store = useLocationStore();
    await store.setEnabled(true);

    store.reset();

    expect(store.coordinates).toBeNull();
  });

  it('survives a platform with no preferences store', async () => {
    get.mockRejectedValue(new Error('unavailable'));
    const store = useLocationStore();

    await store.hydrate();

    expect(store.enabled).toBe(false);
  });
});
