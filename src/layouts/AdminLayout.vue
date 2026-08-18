<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom" class="cc-tabbar">
        <ion-tab-button tab="approvals" href="/admin/approvals" class="cc-tabbar__btn">
          <AppIcon name="fact_check" :size="22" />
          <ion-label>Approvals</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="wallet" href="/admin/wallet" class="cc-tabbar__btn">
          <AppIcon name="savings" :size="22" />
          <ion-label>Wallet</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="profile" href="/admin/profile" class="cc-tabbar__btn">
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
 * The admin context gets its own bar for the same reason the therapist one
 * does (README IA: separate dashboards, not extra tabs on the client bar).
 * Without a shell, /admin/approvals was a dead end — no navigation at all, and
 * no route back to the role switcher, which lives on Profile.
 *
 * Three tabs rather than five: approvals is the only admin-specific screen the
 * app has, and the API exposes no admin endpoints yet (people management and
 * monitoring are still roadmap items in docs/FRONTEND_API_HANDOFF.md), so the
 * bar carries what exists — the queue, the shared wallet, and the account.
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
