<template>
  <ion-page>
    <ion-content class="cc-screen">
      <LoadingState v-if="isPending" label="Loading your order…" />
      <template v-else-if="order">
        <div class="cc-confirm">
          <div class="cc-confirm__icon">
            <AppIcon name="check" :size="46" color="var(--cc-color-success)" />
          </div>
          <h2 class="cc-text-h1" style="text-align: center; margin: 0 0 8px">Order confirmed</h2>
          <p class="cc-text-body" style="text-align: center; margin: 0 0 6px">
            CruxCare has your order and payment.
          </p>
          <div class="cc-text-mono" style="text-align: center; color: var(--cc-ink-400); margin-bottom: 24px">
            {{ order.reference }} · {{ formatDate(order.createdAt) }}
          </div>
        </div>

        <AppCard style="margin: 0 16px 14px">
          <div class="cc-row">
            <span class="cc-text-body">Paid from wallet</span>
            <MoneyAmount :value="order.total" :currency="order.currency" />
          </div>
        </AppCard>

        <div class="cc-screen__footer">
          <AppButton style="margin-bottom: 9px" @click="router.replace({ name: 'order-detail', params: { id: order.id } })">
            Track this order
          </AppButton>
          <AppButton variant="secondary" @click="router.replace({ name: 'catalog' })">Keep shopping</AppButton>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppButton, AppCard, AppIcon, MoneyAmount } from '@/components/ui';
import { LoadingState } from '@/components/state';
import { useOrder } from '@/composables/useOrders';

const route = useRoute();
const router = useRouter();
const { data: order, isPending } = useOrder(route.params.id as string);

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-0);
}
.cc-confirm {
  padding: 48px 24px 0;
}
.cc-confirm__icon {
  width: 88px;
  height: 88px;
  border-radius: 999px;
  background: rgba(46, 158, 91, 0.14);
  display: grid;
  place-items: center;
  margin: 0 auto 20px;
}
.cc-row {
  display: flex;
  justify-content: space-between;
}
.cc-screen__footer {
  padding: 16px 20px calc(28px + env(safe-area-inset-bottom));
}
</style>
