<template>
  <ion-page>
    <div class="cc-inbox__header">
      <div class="cc-inbox__title-row">
        <button type="button" class="cc-inbox__back" aria-label="Back" @click="goBack">
          <AppIcon name="arrow_back_ios_new" :size="22" color="var(--cc-ink-900)" />
        </button>
        <span class="cc-text-h1 cc-inbox__title">Notifications</span>
        <button type="button" class="cc-inbox__markall" @click="onMarkAll">Mark all read</button>
      </div>
      <div class="cc-inbox__chips">
        <AppChip :label="`All ${notifications?.length ?? 0}`" :selected="category === 'all'" @click="category = 'all'" />
        <AppChip label="Care" :selected="category === 'appointments'" @click="category = 'appointments'" />
        <AppChip label="Money" :selected="category === 'wallet'" @click="category = 'wallet'" />
        <AppChip label="Orders" :selected="category === 'orders'" @click="category = 'orders'" />
      </div>
    </div>
    <ion-content class="cc-screen">
      <LoadingState v-if="isPending" label="Loading notifications…" />
      <EmptyState v-else-if="!filtered.length" icon="notifications" title="Nothing here" message="You're all caught up." />
      <AppCard v-else style="margin: 0 16px; padding: 0">
        <div v-for="n in filtered" :key="n.id" class="cc-notif" :class="{ 'cc-notif--unread': !n.read }" @click="onOpen(n)">
          <AppIcon :name="iconFor(n.category)" :size="20" color="var(--cc-color-primary)" />
          <div class="cc-notif__body">
            <div class="cc-text-body-strong" style="font-size: 13.5px">{{ n.title }}</div>
            <div class="cc-text-caption">{{ n.body }}</div>
          </div>
          <span v-if="!n.read" class="cc-notif__dot" />
        </div>
      </AppCard>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppCard, AppChip, AppIcon } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { useMarkNotificationRead, useNotifications } from '@/composables/useNotifications';
import type { AppNotification, NotificationCategory } from '@/types/notifications';

/** SH1 · Notifications — unread tinted and dotted, settings escape at the foot. */
const router = useRouter();
const { data: notifications, isPending } = useNotifications();
const markRead = useMarkNotificationRead();
const category = ref<'all' | NotificationCategory>('all');

const filtered = computed(() =>
  category.value === 'all' ? notifications.value ?? [] : (notifications.value ?? []).filter((n) => n.category === category.value),
);

const iconMap: Record<NotificationCategory, string> = {
  appointments: 'event_upcoming',
  orders: 'local_shipping',
  wallet: 'savings',
  chat: 'forum',
  system: 'campaign',
};
function iconFor(c: NotificationCategory) {
  return iconMap[c] ?? 'notifications';
}

function onOpen(n: AppNotification) {
  if (!n.read) markRead.mutate(n.id);
  if (n.actionRoute) router.push(n.actionRoute);
}
function onMarkAll() {
  notifications.value?.filter((n) => !n.read).forEach((n) => markRead.mutate(n.id));
}
function goBack() {
  if (window.history.state?.back) router.back();
  else router.replace({ name: 'tabs-home' });
}
</script>

<style scoped>
.cc-inbox__header {
  padding: calc(env(safe-area-inset-top) + 4px) 16px 12px;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.62) 55%, rgba(247, 250, 249, 0.92));
}
.cc-inbox__title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}
.cc-inbox__back {
  width: var(--cc-touch-min);
  height: var(--cc-touch-min);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: -10px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
}
.cc-inbox__title {
  flex: 1;
}
.cc-inbox__markall {
  background: none;
  border: none;
  color: var(--cc-color-primary);
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 12.5px;
  cursor: pointer;
}
.cc-inbox__chips {
  display: flex;
  gap: 7px;
  overflow-x: auto;
}
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-notif {
  display: flex;
  gap: 11px;
  align-items: flex-start;
  padding: 13px 14px;
  border-bottom: 1px solid var(--cc-divider);
  cursor: pointer;
}
.cc-notif:last-child {
  border-bottom: none;
}
.cc-notif--unread {
  background: #f4faf8;
}
.cc-notif__body {
  flex: 1;
}
.cc-notif__dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--cc-color-primary);
  margin-top: 5px;
  flex-shrink: 0;
}
</style>
