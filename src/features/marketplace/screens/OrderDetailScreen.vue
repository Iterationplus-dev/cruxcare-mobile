<template>
  <ion-page>
    <AppHeader :title="order ? `Order ${order.reference}` : 'Order'" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <LoadingState v-if="isPending" label="Loading order…" />
      <div v-else-if="order" class="cc-screen__pad">
        <AppCard>
          <div class="cc-od__head">
            <AppBadge :label="order.status" tone="success" />
            <span class="cc-text-caption">{{ order.items.length }} item(s)</span>
          </div>
          <div v-for="(event, i) in timeline" :key="i" class="cc-od__step">
            <div class="cc-od__rail">
              <span class="cc-od__dot" :class="{ 'cc-od__dot--done': event.done }" />
              <span v-if="i < timeline.length - 1" class="cc-od__line" />
            </div>
            <div>
              <div class="cc-text-body-strong" :style="{ fontSize: '13.5px', color: event.done ? undefined : 'var(--cc-ink-400)' }">
                {{ event.label }}
              </div>
              <div class="cc-text-caption">{{ event.detail }}</div>
            </div>
          </div>
        </AppCard>

        <AppCard>
          <div v-for="item in order.items" :key="item.productId" class="cc-od__item">
            <span class="cc-text-body">{{ item.productName }} × {{ item.quantity }}</span>
            <MoneyAmount :value="item.unitPrice * item.quantity" :currency="order.currency" size="mono" />
          </div>
          <div class="cc-od__divider" />
          <div class="cc-od__item">
            <span class="cc-text-body-strong">Total</span>
            <MoneyAmount :value="order.total" :currency="order.currency" />
          </div>
        </AppCard>

        <AppButton variant="secondary" @click="router.push({ name: 'catalog' })">Reorder</AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppBadge, AppButton, AppCard, AppHeader, MoneyAmount } from '@/components/ui';
import { LoadingState } from '@/components/state';
import { useOrder } from '@/composables/useOrders';

const STEPS = ['pending', 'confirmed', 'fulfilled'] as const;

const route = useRoute();
const router = useRouter();
const { data: order, isPending } = useOrder(route.params.id as string);

const timeline = computed(() => {
  if (!order.value) return [];
  const currentIndex = STEPS.indexOf(order.value.status as (typeof STEPS)[number]);
  return [
    { label: 'Order placed', detail: formatEvent(order.value.timeline[0]?.at), done: true },
    { label: 'Packed', detail: 'Awaiting fulfillment', done: currentIndex >= 1 },
    { label: 'Delivered', detail: 'Track from here once shipped', done: currentIndex >= 2 },
  ];
});

function formatEvent(iso?: string) {
  return iso ? new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
}
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cc-od__head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 14px;
}
.cc-od__step {
  display: flex;
  gap: 12px;
}
.cc-od__rail {
  width: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.cc-od__dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 2px solid var(--cc-line);
  box-sizing: border-box;
}
.cc-od__dot--done {
  background: var(--cc-color-success);
  border-color: var(--cc-color-success);
}
.cc-od__line {
  flex: 1;
  width: 2px;
  background: var(--cc-line);
  min-height: 20px;
}
.cc-od__item {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}
.cc-od__divider {
  height: 1px;
  background: var(--cc-divider);
  margin: 8px 0;
}
</style>
