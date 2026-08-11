<template>
  <ion-app class="cc-app" :class="{ 'cc-app--authenticated': isAuthenticatedRoute }">
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { useRoute } from 'vue-router';
import { useToast } from '@/composables/useToast';

/**
 * Hardware back button: navigate back through history when there is any: (Android
 * WebView back-history, one step further than Vue Router's own history), otherwise
 * require a second press within 2s to exit — a single press exiting straight from
 * a root screen (Welcome, a tab) is too easy to trigger by accident.
 */
const toast = useToast();
const route = useRoute();
const isAuthenticatedRoute = computed(() => route.matched.some((record) => record.meta.requiresAuth));
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

<style>
.cc-app--authenticated {
  background: var(--cc-surface-app) url('@/assets/images/screen-bg.png') center top / cover no-repeat;
}

/* Authenticated route components retain their own cards and controls, while
   the shared botanical asset supplies the base screen surface behind them. */
.cc-app--authenticated ion-content.cc-screen {
  --background: url('@/assets/images/screen-bg.png') center top / cover no-repeat !important;
}

.cc-app--authenticated ion-content.cc-screen::part(background) {
  background: var(--background) !important;
}
</style>
