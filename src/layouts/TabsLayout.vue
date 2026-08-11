<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet />
      <ion-tab-bar slot="bottom" class="cc-tabbar">
        <template v-if="memberContext">
          <ion-tab-button tab="member-home" href="/tabs/member-home" class="cc-tabbar__btn">
            <AppIcon name="home" :size="22" />
            <ion-label>Home</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="shop" href="/tabs/shop" class="cc-tabbar__btn">
            <AppIcon name="storefront" :size="22" />
            <ion-label>Shop</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="grow" href="/tabs/grow" class="cc-tabbar__btn">
            <AppIcon name="trending_up" :size="22" />
            <ion-label>Grow</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="wallet" href="/tabs/wallet" class="cc-tabbar__btn">
            <AppIcon name="account_balance_wallet" :size="22" />
            <ion-label>Wallet</ion-label>
          </ion-tab-button>
          <ion-tab-button tab="more" href="/tabs/more" class="cc-tabbar__btn">
            <AppIcon name="more_horiz" :size="22" />
            <ion-label>More</ion-label>
          </ion-tab-button>
        </template>
        <template v-else>
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
        </template>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonLabel, IonPage, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const memberContext = computed(() => auth.activeRole === 'member');
</script>

<style scoped>
.cc-tabbar { height:var(--cc-tabbar-height); --background:var(--cc-surface-0); --border:1px solid var(--cc-line); padding-bottom:max(8px, env(safe-area-inset-bottom)); }
.cc-tabbar__btn { --color:var(--cc-ink-400); --color-selected:var(--cc-color-primary); font-family:var(--cc-font-interface); }
.cc-tabbar__btn ion-label { margin-top:2px; font-size:10.5px; font-weight:500; line-height:14.5px; }
.cc-tabbar__btn.tab-selected ion-label { font-weight:600; }
</style>
