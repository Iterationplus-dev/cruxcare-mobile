import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkPermissions = vi.fn();
const requestPermissions = vi.fn();
const getCurrentPosition = vi.fn();

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: { checkPermissions, requestPermissions, getCurrentPosition },
}));

const { formatCoordinates, readDeviceLocation } = await import('@/services/deviceLocation');

/** No default on `accuracy`: passing `undefined` explicitly would trigger one,
 *  which is exactly the case the last test needs to exercise. */
function position(latitude: number, longitude: number, accuracy: number | undefined) {
  return { coords: { latitude, longitude, accuracy } };
}

describe('readDeviceLocation', () => {
  beforeEach(() => {
    checkPermissions.mockReset();
    requestPermissions.mockReset();
    getCurrentPosition.mockReset();
  });

  it('reads a fix when permission is already granted, without asking again', async () => {
    checkPermissions.mockResolvedValue({ location: 'granted' });
    getCurrentPosition.mockResolvedValue(position(6.455, 3.3841, 12));

    const outcome = await readDeviceLocation();

    expect(outcome).toEqual({
      ok: true,
      coordinates: { latitude: 6.455, longitude: 3.3841, accuracy: 12 },
    });
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it('asks when permission has not been decided', async () => {
    checkPermissions.mockResolvedValue({ location: 'prompt' });
    requestPermissions.mockResolvedValue({ location: 'granted' });
    getCurrentPosition.mockResolvedValue(position(1, 2, 12));

    expect((await readDeviceLocation()).ok).toBe(true);
    expect(requestPermissions).toHaveBeenCalledOnce();
  });

  it('does not re-prompt someone who has already refused', async () => {
    // Asking again after a denial is nagging, and on Android it is silently
    // refused anyway.
    checkPermissions.mockResolvedValue({ location: 'denied' });

    expect(await readDeviceLocation()).toEqual({ ok: false, reason: 'denied' });
    expect(requestPermissions).not.toHaveBeenCalled();
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('reports a refusal at the prompt as denied, not as a failure', async () => {
    checkPermissions.mockResolvedValue({ location: 'prompt' });
    requestPermissions.mockResolvedValue({ location: 'denied' });

    expect(await readDeviceLocation()).toEqual({ ok: false, reason: 'denied' });
  });

  it('reports a timeout or missing GPS as unavailable', async () => {
    // A different situation from a refusal: it might work next time.
    checkPermissions.mockResolvedValue({ location: 'granted' });
    getCurrentPosition.mockRejectedValue(new Error('timeout'));

    expect(await readDeviceLocation()).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('survives a platform with no geolocation at all', async () => {
    checkPermissions.mockRejectedValue(new Error('not implemented'));

    expect(await readDeviceLocation()).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('keeps a fix that reports no accuracy', async () => {
    checkPermissions.mockResolvedValue({ location: 'granted' });
    getCurrentPosition.mockResolvedValue(position(6.455, 3.3841, undefined));

    const outcome = await readDeviceLocation();

    expect(outcome).toMatchObject({ ok: true, coordinates: { accuracy: null } });
  });
});

describe('formatCoordinates', () => {
  it('rounds so the display does not imply more precision than it has', () => {
    expect(
      formatCoordinates({ latitude: 6.4550834, longitude: 3.3841201, accuracy: 12 }),
    ).toBe('6.4551, 3.3841');
  });
});
