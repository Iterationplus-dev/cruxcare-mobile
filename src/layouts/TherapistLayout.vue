<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom" class="cc-tabbar">
        <ion-tab-button tab="today" href="/therapist/today" class="cc-tabbar__btn">
          <AppIcon name="today" :size="22" />
          <ion-label>Today</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="calendar" href="/therapist/calendar" class="cc-tabbar__btn">
          <AppIcon name="calendar_month" :size="22" />
          <ion-label>Calendar</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="clients" href="/therapist/clients" class="cc-tabbar__btn">
          <AppIcon name="groups" :size="22" />
          <ion-label>Clients</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="earnings" href="/therapist/earnings" class="cc-tabbar__btn">
          <AppIcon name="payments" :size="22" />
          <ion-label>Earnings</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="profile" href="/therapist/profile" class="cc-tabbar__btn">
          <AppIcon name="person" :size="22" />
          <ion-label>Profile</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { IonLabel, IonPage, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/vue';
import AppIcon from '@/components/ui/AppIcon.vue';

/**
 * TD1's screenshot draws its own 5-tab bar — a separate one from the
 * client's, not extra items bolted onto it. That reconciles with README's
 * "separate dashboards ... not extra tabs [on the client bar]" IA rule.
 */
</script>

<style scoped>
.cc-tabbar {
  height: var(--cc-tabbar-height);
  --background: var(--cc-surface-0);
  --border: 1px solid var(--cc-line);
  padding-bottom: max(8px, env(safe-area-inset-bottom));
}
.cc-tabbar__btn {
  --color: var(--cc-ink-400);
  --color-selected: var(--cc-color-primary);
  font-family: var(--cc-font-interface);
}
.cc-tabbar__btn ion-label {
  font-size: 10.5px;
  line-height: 14.5px;
  font-weight: 500;
  margin-top: 2px;
}
.cc-tabbar__btn.tab-selected ion-label {
  font-weight: 600;
}
</style>
