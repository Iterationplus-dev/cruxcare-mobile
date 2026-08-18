<template>
  <ion-page>
    <AppHeader title="Your orders" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['orders']]" />
      <LoadingState v-if="isPending" label="Loading orders…" />
      <EmptyState
        v-else-if="!orders?.data.length"
        icon="receipt_long"
        title="No orders yet"
        message="Browse the shop to place your first order."
        primary-action="Browse the shop"
        @primary="router.push({ name: 'catalog' })"
      />
      <AppCard v-else style="margin: 16px; padding: 0">
        <AppListRow
          v-for="o in orders.data"
          :key="o.id"
          :title="o.reference"
          :subtitle="`${o.items.length} item(s) · ${o.status}`"
          chevron
          clickable
          @click="router.push({ name: 'order-detail', params: { id: o.id } })"
        >
          <template #trailing>
            <MoneyAmount :value="o.total" :currency="o.currency" size="mono" />
          </template>
        </AppListRow>
      </AppCard>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { AppPullToRefresh } from '@/components/ui';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppCard, AppHeader, AppListRow, MoneyAmount } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { useOrders } from '@/composables/useOrders';

const router = useRouter();
const { data: orders, isPending } = useOrders();
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-app);
}
</style>
