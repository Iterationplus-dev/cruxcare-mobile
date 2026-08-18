<template>
  <ion-page>
    <AppHeader title="Ledger" show-back :botanical="false" />
    <div class="cc-ledger__filters">
      <AppChip v-for="f in filters" :key="f" :label="f" :selected="filter === f" @click="filter = f" />
    </div>
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['wallet']]" />
      <LoadingState v-if="isPending" label="Loading ledger…" />
      <EmptyState
        v-else-if="!grouped.length"
        icon="receipt_long"
        title="No transactions"
        message="Nothing matches this filter yet."
      />
      <div v-else class="cc-screen__pad">
        <div v-for="group in grouped" :key="group.day">
          <div class="cc-text-body-strong cc-ledger__day">{{ group.day }}</div>
          <AppCard style="padding: 0; margin-bottom: 14px">
            <div v-for="txn in group.items" :key="txn.id" class="cc-ledger-row">
              <div class="cc-ledger-row__body">
                <div class="cc-text-body-strong" style="font-size: 14.5px">{{ txn.description }}</div>
                <div class="cc-text-caption">{{ txn.reference }}</div>
              </div>
              <MoneyAmount :value="txn.amount" :currency="txn.currency" show-sign />
            </div>
          </AppCard>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { AppPullToRefresh } from '@/components/ui';
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { AppCard, AppChip, AppHeader, MoneyAmount } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { useLedger } from '@/composables/useWallet';

/** E2 · Ledger — grouped by day, fees named on the row. */
const { data, isPending } = useLedger();
const filters = ['All', 'Money in', 'Money out', 'Pending'] as const;
const filter = ref<(typeof filters)[number]>('All');

const filtered = computed(() => {
  const items = data.value?.data ?? [];
  if (filter.value === 'Money in') return items.filter((t) => t.amount > 0);
  if (filter.value === 'Money out') return items.filter((t) => t.amount < 0);
  if (filter.value === 'Pending') return [];
  return items;
});

const grouped = computed(() => {
  const map = new Map<string, typeof filtered.value>();
  for (const txn of filtered.value) {
    const day = new Date(txn.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long' });
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(txn);
  }
  return Array.from(map.entries()).map(([day, items]) => ({ day, items }));
});
</script>

<style scoped>
.cc-ledger__filters {
  display: flex;
  gap: 8px;
  padding: 0 16px 12px;
  overflow-x: auto;
  background: var(--cc-surface-app);
}
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 14px 16px;
}
.cc-ledger__day {
  font-size: 13.5px;
  margin-bottom: 8px;
}
.cc-ledger-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--cc-divider);
  align-items: center;
}
.cc-ledger-row:last-child {
  border-bottom: none;
}
</style>
