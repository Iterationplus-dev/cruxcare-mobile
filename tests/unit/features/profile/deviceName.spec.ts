import { describe, expect, it } from 'vitest';
import { friendlyDeviceName } from '@/features/profile/deviceName';

describe('friendlyDeviceName', () => {
  it('reads the Android WebView agent the app actually signs in with', () => {
    // This is verbatim what the devices screen showed before: precise, and
    // useless for the one job the screen has.
    expect(
      friendlyDeviceName(
        'Dalvik/2.1.0 (Linux; U; Android 16; sdk_gphone64_x86_64 Build/BE2A.250530.026.D1)',
      ),
    ).toBe('sdk_gphone64_x86_64 · Android 16');
  });

  it('drops the build fingerprint, which nobody reads', () => {
    expect(
      friendlyDeviceName('Dalvik/2.1.0 (Linux; U; Android 14; Pixel 8 Build/UQ1A.240205.004)'),
    ).toBe('Pixel 8 · Android 14');
  });

  it('falls back to the version alone when there is no model', () => {
    expect(friendlyDeviceName('Dalvik/2.1.0 (Linux; U; Android 13)')).toBe('Android 13');
  });

  it('reads an iOS agent', () => {
    expect(
      friendlyDeviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X)'),
    ).toBe('iPhone · iOS 17.2');
  });

  it('names a desktop browser', () => {
    expect(
      friendlyDeviceName(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
      ),
    ).toBe('Chrome on Windows');
  });

  it('leaves a plain name alone', () => {
    // Some clients register a real name; it should be shown as sent rather
    // than run through a parser looking for an agent.
    expect(friendlyDeviceName("Amara's iPad")).toBe("Amara's iPad");
  });

  it('trims an agent it cannot read rather than discarding it', () => {
    // Still the only thing that might distinguish two rows.
    const odd = `SomeClient/1.0 (${'x'.repeat(80)})`;

    const name = friendlyDeviceName(odd);
    expect(name.length).toBeLessThanOrEqual(49);
    expect(name.startsWith('SomeClient/1.0')).toBe(true);
  });

  it('says so when there is no name at all', () => {
    expect(friendlyDeviceName(null)).toBe('Unnamed device');
    expect(friendlyDeviceName('   ')).toBe('Unnamed device');
  });
});
