<template>
  <ion-app class="cc-app" :class="{ 'cc-app--authenticated': isAuthenticatedRoute }">
    <ion-router-outlet />
    <AppFeedbackSheet />
  </ion-app>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { useQueryClient } from '@tanstack/vue-query';
import { useRoute, useRouter } from 'vue-router';
import AppFeedbackSheet from '@/components/ui/AppFeedbackSheet.vue';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/auth';
import {
  enablePushNotifications,
  initPushNotifications,
  teardownPushNotifications,
} from '@/services/push/pushNotifications';

/**
 * Hardware back button: navigate back through history when there is any: (Android
 * WebView back-history, one step further than Vue Router's own history), otherwise
 * require a second press within 2s to exit — a single press exiting straight from
 * a root screen (Welcome, a tab) is too easy to trigger by accident.
 */
const toast = useToast();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const queryClient = useQueryClient();
const isAuthenticatedRoute = computed(() => route.matched.some((record) => record.meta.requiresAuth));
let backListener: PluginListenerHandle | undefined;
let stateListener: PluginListenerHandle | undefined;
let lastBackPressAt = 0;

/**
 * Started here rather than in `onMounted` because the session watcher below
 * runs immediately: a cold start with a stored session is already
 * authenticated by the time this component sets up (the router guard hydrates
 * before mount), so registering first and attaching listeners afterwards would
 * miss the `registration` event that carries the token.
 *
 * A push that lands while the app is open should also update the inbox and its
 * badge without the user pulling to refresh.
 */
const pushReady = Capacitor.isNativePlatform()
  ? initPushNotifications({
      router,
      onNotificationReceived: (data) => {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        for (const key of queryKeysForCategory(data.category)) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      },
    })
  : Promise.resolve();

/**
 * A push announces that something changed server-side, so the screen behind it
 * should not keep showing the old value. The category is the only routing
 * information the payload carries, so the refresh is scoped by that and
 * deliberately kept broad — refetching a little too much is cheaper than
 * leaving a settled payment reading as pending.
 */
function queryKeysForCategory(category: string | undefined): string[][] {
  switch (category) {
    case 'wallet':
      return [['wallet'], ['wallet', 'ledger']];
    case 'appointments':
      return [['appointments'], ['care', 'requests']];
    case 'orders':
      return [['orders']];
    case 'chat':
      return [['chat', 'threads']];
    case 'system':
      // Care requests and plan/verification changes all arrive as `system`.
      return [['care', 'requests'], ['case-files'], ['wallet']];
    default:
      return [];
  }
}

/**
 * Push registration follows the session rather than app start: a token is only
 * useful once it can be attached to a user, and permission is asked for at the
 * point it makes sense rather than on a cold first launch. Sign-out is handled
 * in the auth store, which still has a token to revoke with.
 */
watch(
  () => auth.isAuthenticated,
  async (authenticated) => {
    if (!authenticated) return;
    await pushReady;
    const result = await enablePushNotifications();
    if (result.status === 'error') {
      console.error('Push notifications are unavailable:', result.message);
    }
  },
  { immediate: true },
);

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

  /**
   * Exchange rates move and a country can be switched off while the app sits
   * in the background, so a resumed session must not keep showing a local
   * figure derived from a stale rate — or offer a currency that has since
   * stopped being fundable.
   */
  stateListener = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (!isActive) return;
    void queryClient.invalidateQueries({ queryKey: ['currencies'] });
    void queryClient.invalidateQueries({ queryKey: ['wallet'] });
  });
});

onUnmounted(() => {
  void backListener?.remove();
  void stateListener?.remove();
  void teardownPushNotifications();
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