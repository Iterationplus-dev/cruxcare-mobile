import { Capacitor } from '@capacitor/core';
import { Style, StatusBar } from '@capacitor/status-bar';

/**
 * Screens are drawn with the status bar as part of the layout (botanical
 * background bleeding behind it, dark screens like Welcome/Video needing
 * white icons) — that requires edge-to-edge/overlay mode plus a per-screen
 * icon style, neither of which Capacitor enables by default on Android.
 */
async function run(fn: () => Promise<void>) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await fn();
  } catch {
    // Best-effort — a missing/unsupported StatusBar API shouldn't break the screen.
  }
}

/** Icon color per screen is set by the router's afterEach (see router/index.ts). */
export function initStatusBar() {
  void run(async () => {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setBackgroundColor({ color: '#00000000' });
  });
}

/** Dark icons — for the app's normal light/white screens. */
export function applyLightScreenIcons() {
  void run(() => StatusBar.setStyle({ style: Style.Light }));
}

/** White icons — for dark-background screens (Welcome, video visit, etc.). */
export function applyDarkScreenIcons() {
  void run(() => StatusBar.setStyle({ style: Style.Dark }));
}
