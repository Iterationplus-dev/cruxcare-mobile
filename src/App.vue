<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { useToast } from '@/composables/useToast';

/**
 * Hardware back button: navigate back through history when there is any: (Android
 * WebView back-history, one step further than Vue Router's own history), otherwise
 * require a second press within 2s to exit — a single press exiting straight from
 * a root screen (Welcome, a tab) is too easy to trigger by accident.
 */
const toast = useToast();
let backListener: PluginListenerHandle | undefined;
let lastBackPressAt = 0;

onMounted(async () => {
  if (!Capacitor.isNativePlatform()) return;
  backListener = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
      return;
    }
    const now = Date.now();
    if (now - lastBackPressAt < 2000) {
      void CapacitorApp.exitApp();
    } else {
      lastBackPressAt = now;
      void toast.show('Press back again to exit', 'info', 2000);
    }
  });
});

onUnmounted(() => {
  void backListener?.remove();
});
</script>
