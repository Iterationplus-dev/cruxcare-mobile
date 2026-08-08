<template>
  <ion-page>
    <div class="cc-earn__header">
      <span class="cc-text-h1">Earnings</span>
      <LoadingState v-if="isPending" label="Loading earnings…" />
      <template v-else-if="wallet">
        <div class="cc-text-caption" style="color: var(--cc-color-primary)">Available</div>
        <MoneyAmount :value="wallet.available" :currency="wallet.currency" size="display" />
      </template>
    </div>
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <div class="cc-text-body-strong" style="font-size: 15px">Recent activity</div>
        <LoadingState v-if="ledgerPending" label="Loading activity…" />
        <EmptyState v-else-if="!ledger?.data.length" icon="payments" title="No earnings yet" message="Session and rank earnings will post here." />
        <AppCard v-else style="padding: 0">
          <div v-for="txn in ledger.data" :key="txn.id" class="cc-row">
            <div class="cc-row__body">
              <div class="cc-text-body-strong" style="font-size: 14px">{{ txn.description }}</div>
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
import { IonContent, IonPage } from '@ionic/vue';
import { AppCard, MoneyAmount } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { useLedger, useWallet } from '@/composables/useWallet';

const { data: wallet, isPending } = useWallet();
const { data: ledger, isPending: ledgerPending } = useLedger();

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}
</script>

<style scoped>
.cc-earn__header {
  padding: 6px 16px 20px;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.62) 55%, rgba(247, 250, 249, 0.92));
}
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
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
