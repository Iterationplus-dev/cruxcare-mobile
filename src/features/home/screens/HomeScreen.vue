<template>
  <ion-page>
    <ion-content class="cc-screen" :scroll-y="true">
      <div class="cc-home__header">
        <AppAvatar :name="fullName" :size="40" />
        <div class="cc-home__greeting">
          <div class="cc-home__date">{{ formattedDate }}</div>
          <div class="cc-home__hello cc-text-h2">{{ greeting }}, {{ auth.user?.firstName }}</div>
        </div>
        <button type="button" class="cc-home__bell" aria-label="Notifications" @click="goNotifications">
          <AppIcon name="notifications" :size="24" color="var(--cc-ink-900)" />
          <span v-if="unreadCount > 0" class="cc-home__bell-dot" />
        </button>
      </div>

      <div class="cc-home__body">
        <LoadingState v-if="appointmentsQuery.isPending.value" label="Loading your home…" />
        <template v-else>
          <AppCard v-if="nextAppointment">
            <div class="cc-home__session-head">
              <span class="cc-text-mono" style="font-size: 11.5px; color: var(--cc-ink-400)">NEXT SESSION</span>
              <AppBadge label="CONFIRMED" tone="success" />
            </div>
            <div class="cc-home__session-body">
              <AppAvatar :name="nextAppointment.therapistName" :size="46" />
              <div class="cc-home__session-info">
                <div class="cc-text-body-strong">{{ nextAppointment.therapistName }}</div>
                <div class="cc-text-subtitle">{{ formatSlot(nextAppointment.slot) }} · {{ nextAppointment.type }}</div>
              </div>
            </div>
            <div class="cc-home__session-actions">
              <AppButton @click="joinSession">Join</AppButton>
              <AppButton variant="secondary" @click="goCare">Reschedule</AppButton>
            </div>
          </AppCard>
          <EmptyState
            v-else
            icon="event_available"
            title="No upcoming session"
            message="Book time with a therapist when you're ready."
            primary-action="Find a therapist"
            @primary="goCare"
          />

          <div class="cc-home__stats">
            <AppStatTile icon="savings" label="Wallet">
              <MoneyAmount v-if="wallet" :value="wallet.available" :currency="wallet.currency" size="mono" />
              <StateSkeleton v-else width="60px" height="18px" />
            </AppStatTile>
            <AppStatTile icon="receipt_long" label="Orders" :value="String(orders?.data.length ?? 0)" />
          </div>

          <div class="cc-home__section-head">
            <span class="cc-text-body-strong" style="font-size: 14.5px">Reorder</span>
            <a href="#" class="cc-text-body-strong" style="font-size: 12.5px" @click.prevent="goShop">Shop</a>
          </div>
          <div v-if="reorderProducts.length" class="cc-home__reorder">
            <button
              v-for="p in reorderProducts"
              :key="p.id"
              type="button"
              class="cc-home__product"
              @click="router.push({ name: 'product-detail', params: { id: p.id } })"
            >
              <img :src="p.media[0]?.url" :alt="p.media[0]?.alt ?? p.name" />
              <div class="cc-home__product-body">
                <div class="cc-text-body-strong" style="font-size: 12.5px">{{ p.name }}</div>
                <MoneyAmount :value="p.price" :currency="p.currency" size="mono" />
              </div>
            </button>
          </div>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import {
  AppAvatar,
  AppBadge,
  AppButton,
  AppCard,
  AppIcon,
  AppStatTile,
  MoneyAmount,
} from '@/components/ui';
import { EmptyState, LoadingState, StateSkeleton } from '@/components/state';
import { useAppointments } from '@/composables/useAppointments';
import { useWallet } from '@/composables/useWallet';
import { useOrders } from '@/composables/useOrders';
import { useProducts } from '@/composables/useProducts';
import { useAuthStore } from '@/stores/auth';
import { fullName as formatFullName } from '@/types/user';

/**
 * CD1 · Home — canonical Home-tab screen for both client and member roles
 * (README's IA gives member no separate tab; member context — Crux ID,
 * rank — surfaces inside Profile/Wallet instead of a duplicate B2 screen).
 */
const router = useRouter();
const auth = useAuthStore();

const fullName = computed(() => (auth.user ? formatFullName(auth.user) : ''));
const unreadCount = 1; // wired to the real count once SH1 notifications ships

const formattedDate = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const greeting = (() => {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
})();

const appointmentsQuery = useAppointments();
const nextAppointment = computed(() =>
  appointmentsQuery.data.value?.data.find((a) => a.status === 'confirmed' || a.status === 'requested'),
);

const { data: wallet } = useWallet();
const { data: orders } = useOrders();
const { data: fallbackProducts } = useProducts({});

const reorderProducts = computed(() => {
  const fromOrders = orders?.value?.data
    .flatMap((o) => o.items.map((i) => i.productId))
    .slice(0, 2);
  const pool = fallbackProducts?.value?.data ?? [];
  if (fromOrders?.length) {
    const found = fromOrders.map((id) => pool.find((p) => p.id === id)).filter(Boolean);
    if (found.length) return found as typeof pool;
  }
  return pool.slice(0, 2);
});

function formatSlot(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function joinSession() {
  if (nextAppointment.value) {
    router.push({ name: 'video-visit', params: { id: nextAppointment.value.id } });
  }
}
function goCare() {
  router.push({ name: 'care-hub' });
}
function goShop() {
  router.push({ name: 'catalog' });
}
function goNotifications() {
  router.push({ name: 'notifications' });
}
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-home__header {
  padding: calc(env(safe-area-inset-top) + 6px) 16px 18px;
  display: flex;
  align-items: center;
  gap: 11px;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(247, 250, 249, 0.38) 55%, rgba(247, 250, 249, 0.62));
}
.cc-home__greeting {
  flex: 1;
}
.cc-home__date {
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  color: var(--cc-color-primary);
}
.cc-home__hello {
  margin: 0;
}
.cc-home__bell {
  position: relative;
  background: none;
  border: none;
  display: flex;
  cursor: pointer;
}
.cc-home__bell-dot {
  position: absolute;
  top: 0;
  right: -1px;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--cc-color-warning);
  border: 1.5px solid var(--cc-surface-app);
}
.cc-home__body {
  padding: 0 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cc-home__session-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 11px;
}
.cc-home__session-body {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}
.cc-home__session-info {
  flex: 1;
}
.cc-home__session-actions {
  display: flex;
  gap: 8px;
}
.cc-home__session-actions :deep(.cc-btn) {
  height: 40px;
  font-size: 13.5px;
}
.cc-home__stats {
  display: flex;
  gap: 9px;
}
.cc-home__section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.cc-home__reorder {
  display: flex;
  gap: 9px;
}
.cc-home__product {
  flex: 1;
  background: var(--cc-surface-0);
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-lg);
  overflow: hidden;
  padding: 0;
  cursor: pointer;
  text-align: left;
}
.cc-home__product img {
  width: 100%;
  height: 74px;
  object-fit: cover;
  display: block;
}
.cc-home__product-body {
  padding: 8px 9px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
