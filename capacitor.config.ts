import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cruxcintl.mobile',
  appName: 'CruxCare Mobile',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      // Without this the plugin shows nothing while the app is in the
      // foreground, so a message that arrives mid-session is silently lost.
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'FIT_XY',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
