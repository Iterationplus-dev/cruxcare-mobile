<template>
  <ion-tabs>
    <ion-router-outlet />
    <ion-tab-bar slot="bottom" class="cc-tabbar">
      <ion-tab-button tab="home" href="/tabs/home" class="cc-tabbar__btn">
        <AppIcon name="home" :size="22" />
        <ion-label>Home</ion-label>
      </ion-tab-button>
      <ion-tab-button tab="shop" href="/tabs/shop" class="cc-tabbar__btn">
        <AppIcon name="storefront" :size="22" />
        <ion-label>Shop</ion-label>
      </ion-tab-button>
      <ion-tab-button tab="care" href="/tabs/care" class="cc-tabbar__btn">
        <AppIcon name="spa" :size="22" />
        <ion-label>Care</ion-label>
      </ion-tab-button>
      <ion-tab-button tab="wallet" href="/tabs/wallet" class="cc-tabbar__btn">
        <AppIcon name="savings" :size="22" />
        <ion-label>Wallet</ion-label>
      </ion-tab-button>
      <ion-tab-button tab="profile" href="/tabs/profile" class="cc-tabbar__btn">
        <AppIcon name="person" :size="22" />
        <ion-label>Profile</ion-label>
      </ion-tab-button>
    </ion-tab-bar>
  </ion-tabs>
</template>

<script setup lang="ts">
import { IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/vue';
import AppIcon from '@/components/ui/AppIcon.vue';

/**
 * The five fixed client tabs (README IA) — always present regardless of
 * member/therapist roles. Therapist/admin are separate dashboards reached
 * via role switch (K4), not additional tabs here.
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
  font-size: 10px;
  line-height: 14px;
  font-weight: 500;
  margin-top: 2px;
}
.cc-tabbar__btn.tab-selected ion-label {
  font-weight: 600;
}
</style>
