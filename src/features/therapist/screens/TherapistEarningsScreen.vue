<template>
  <ion-page>
    <AppHeader title="Earnings" :botanical="false" />
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['wallet']]" />
      <div class="cc-screen__pad">
        <section class="cc-earn__balance" aria-label="Available earnings">
          <div class="cc-earn__balance-label">AVAILABLE EARNINGS</div>
          <div v-if="isPending" class="cc-earn__balance-loading">Loading earnings...</div>
          <template v-else-if="wallet">
            <MoneyAmount :value="wallet.available" :currency="wallet.currency" size="display" />
            <p>Ready to pay out once your account is confirmed.</p>
          </template>
        </section>

        <div class="cc-text-body-strong" style="font-size: 16px">Recent activity</div>
        <LoadingState v-if="ledgerPending" label="Loading activity..." />
        <EmptyState v-else-if="!ledger?.data.length" icon="payments" title="No earnings yet" message="Session and rank earnings will post here." />
        <AppCard v-else style="padding: 0">
          <div v-for="txn in ledger.data" :key="txn.id" class="cc-row">
            <div class="cc-row__body">
              <div class="cc-text-body-strong" style="font-size: 14.5px">{{ txn.description }}</div>
              <div class="cc-text-caption">{{ formatDate(txn.createdAt) }}</div>
            </div>
            <MoneyAmount :value="txn.amount" :currency="txn.currency" show-sign />
          </div>
        </AppCard>
        <p class="cc-text-caption">Payouts and statements ship with the Finance module (TD6).</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { AppPullToRefresh } from '@/components/ui';
import { IonContent, IonPage } from '@ionic/vue';
import { AppCard, AppHeader, MoneyAmount } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { useLedger, useWallet } from '@/composables/useWallet';

const { data: wallet, isPending } = useWallet();
const { data: ledger, isPending: ledgerPending } = useLedger();

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
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
  gap: 12px;
}
.cc-earn__balance {
  padding: 16px;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-lg);
  background: rgba(255, 255, 255, 0.92);
}
.cc-earn__balance-label {
  color: var(--cc-color-primary);
  font-family: var(--cc-font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
}
.cc-earn__balance :deep(.cc-money) {
  display: block;
  margin-top: 6px;
}
.cc-earn__balance p,
.cc-earn__balance-loading {
  margin: 5px 0 0;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 12px;
  line-height: 18px;
}
.cc-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid var(--cc-divider);
}
.cc-row:last-child {
  border-bottom: none;
}
</style>
