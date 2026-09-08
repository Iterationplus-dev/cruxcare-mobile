<template>
  <ion-page>
    <div class="cc-wallet__header">
      <div class="cc-wallet__title-row">
        <span class="cc-text-h1">Wallet</span>
      </div>
      <LoadingState v-if="isPending" label="Loading your wallet…" />
      <template v-else-if="wallet">
        <div class="cc-text-caption" style="color: var(--cc-color-primary)">Available balance</div>
        <MoneyAmount :value="wallet.available" :currency="wallet.currency" size="display" class="cc-wallet__balance" />
        <!-- Display only. The balance is held in USD; this is the same money
             read in the user's own currency, and is absent for anyone with no
             supported country on file. -->
        <div v-if="localAvailable !== null" class="cc-wallet__local">
          <span aria-hidden="true">≈</span>
          <MoneyAmount :value="localAvailable" :currency="wallet.local!.currency" />
          <span v-if="wallet.local!.rateSource === 'system'" class="cc-wallet__local-note">indicative rate</span>
        </div>
        <div class="cc-wallet__updated">
          <AppIcon name="cloud_done" :size="15" color="#cde7e1" />
          From CruxCare · updated {{ relativeUpdated }}
        </div>
        <div class="cc-wallet__allocations">
          <button v-if="wallet.pending > 0" type="button" class="cc-wallet__allocation" @click="router.push({ name: 'ledger' })">
            <span>Pending out</span><MoneyAmount :value="wallet.pending" :currency="wallet.currency" />
          </button>
          <button type="button" class="cc-wallet__allocation" @click="router.push({ name: 'member-commitment' })">
            <span>Committed</span><MoneyAmount :value="wallet.committed ?? 0" :currency="wallet.currency" />
          </button>
          <button type="button" class="cc-wallet__allocation" @click="router.push({ name: 'member-cooperative' })">
            <span>Coop saved</span><MoneyAmount :value="wallet.cooperativeSaved ?? 0" :currency="wallet.currency" />
          </button>
        </div>
      </template>
    </div>

    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['wallet']]" />
      <div class="cc-screen__pad">
        <div class="cc-wallet__actions">
          <button v-for="a in actions" :key="a.label" type="button" class="cc-wallet__action" @click="a.onClick">
            <span class="cc-wallet__action-icon"><AppIcon :name="a.icon" :size="22" color="var(--cc-color-primary)" /></span>
            <span class="cc-wallet__action-label cc-text-body">{{ a.label }}</span>
          </button>
        </div>

        <div class="cc-wallet__section-head">
          <span class="cc-text-body-strong" style="font-size: 16px">Recent activity</span>
          <a href="#" class="cc-text-body-strong" style="font-size: 13.5px" @click.prevent="router.push({ name: 'ledger' })">
            Full ledger
          </a>
        </div>
        <LoadingState v-if="ledgerPending" label="Loading activity…" />
        <EmptyState
          v-else-if="!ledger?.data.length"
          icon="account_balance_wallet"
          title="Nothing has moved yet"
          message="Your ledger fills up as you shop, contribute or earn."
          primary-action="Browse the shop"
          @primary="router.push({ name: 'catalog' })"
        />
        <AppCard v-else style="padding: 0">
          <div v-for="txn in ledger.data.slice(0, 6)" :key="txn.id" class="cc-ledger-row">
            <div class="cc-ledger-row__icon" :style="{ background: iconBg(txn.amount) }">
              <AppIcon :name="ledgerIconForType(txn.type)" :size="19" :color="iconColor(txn.amount)" />
            </div>
            <div class="cc-ledger-row__body">
              <div class="cc-text-body-strong" style="font-size: 14.5px">{{ txn.description }}</div>
              <div class="cc-text-caption">{{ formatDate(txn.createdAt) }}</div>
            </div>
            <div class="cc-ledger-row__end">
              <MoneyAmount :value="txn.amount" :currency="txn.currency" show-sign />
              <div class="cc-text-caption">{{ txn.reference }}</div>
            </div>
          </div>
        </AppCard>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { AppPullToRefresh } from '@/components/ui';
import { computed } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppCard, AppIcon, MoneyAmount } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { useLedger, useWallet } from '@/composables/useWallet';
import { ledgerIconForType } from '@/features/wallet/ledgerPresentation';
import { formatRelativeTime } from '@/utils/formatTime';

/** E1 · Wallet home. Committed/Coop-saved tiles return with the Finance
 * module (Commitment/Cooperative) — showing them now would fabricate
 * figures from a system that doesn't exist yet in this build. */
const router = useRouter();
const { data: wallet, isPending } = useWallet();
const { data: ledger, isPending: ledgerPending } = useLedger();

const relativeUpdated = computed(() => (wallet.value ? formatRelativeTime(wallet.value.lastUpdatedAt) : ''));

/** `local` is null for most users, and an individual amount inside it can be
 * null too — neither is a zero balance, so both fall back to showing USD alone. */
const localAvailable = computed(() => wallet.value?.local?.available ?? null);

const actions = [
  { icon: 'add_card', label: 'Top up', onClick: () => router.push({ name: 'wallet-top-up' }) },
  { icon: 'arrow_outward', label: 'Withdraw', onClick: () => router.push({ name: 'wallet-withdraw' }) },
  { icon: 'swap_horiz', label: 'Transfer', onClick: () => router.push({ name: 'wallet-transfer' }) },
  { icon: 'savings', label: 'Contribute', onClick: () => router.push({ name: 'cooperative-contribute' }) },
  { icon: 'receipt_long', label: 'Statements', onClick: () => router.push({ name: 'ledger' }) },
];

function iconColor(amount: number) {
  // Transfer is used for both legs; the signed amount is the authority.
  return amount >= 0 ? 'var(--cc-color-success-text)' : 'var(--cc-color-warning-text)';
}
function iconBg(amount: number) {
  return amount >= 0 ? 'rgba(46,158,91,0.14)' : 'var(--cc-color-warning-tint)';
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}
</script>

<style scoped>
.cc-wallet__header {
  padding: calc(env(safe-area-inset-top) + 6px) 16px 20px;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.62) 55%, rgba(247, 250, 249, 0.92));
}
.cc-wallet__title-row {
  margin-bottom: 18px;
}
.cc-wallet__balance {
  display: block;
  font-size: 35.5px !important;
  line-height: 42px !important;
}
.cc-wallet__local {
  display: flex;
  align-items: baseline;
  gap: 5px;
  margin-top: 3px;
  color: var(--cc-ink-600);
}
.cc-wallet__local :deep(.cc-money) {
  font-size: 15px;
  color: var(--cc-ink-600);
}
.cc-wallet__local-note {
  font-family: var(--cc-font-interface);
  font-size: 10.5px;
  color: var(--cc-ink-400);
}
.cc-wallet__updated {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  color: #4a5a53;
}
.cc-wallet__allocations {
  display: flex;
  gap: 8px;
  margin-top: 18px;
}
.cc-wallet__allocation {
  flex: 1;
  min-width: 0;
  padding: 10px;
  border: none;
  border-radius: var(--cc-radius-md);
  background: rgba(255, 255, 255, 0.78);
  color: var(--cc-ink-900);
  text-align: left;
  cursor: pointer;
}
.cc-wallet__allocation > span {
  display: block;
  margin-bottom: 2px;
  color: var(--cc-color-primary);
  font-family: var(--cc-font-interface);
  font-size: 10.5px;
}
.cc-wallet__allocation :deep(.cc-money) {
  font-size: 13px;
}
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cc-wallet__actions {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}
.cc-wallet__action {
  background: none;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.cc-wallet__action-icon {
  width: 100%;
  height: 48px;
  border-radius: 14px;
  background: var(--cc-surface-0);
  border: 1px solid var(--cc-line);
  display: grid;
  place-items: center;
}
/* Five labels across a 360px screen: the scale floor is 11.5px, so the label
   is allowed to wrap to a second line rather than being clipped. */
.cc-wallet__action-label {
  font-size: 11.5px;
  line-height: 14px;
  text-align: center;
}
.cc-wallet__section-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.cc-ledger-row {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid var(--cc-divider);
}
.cc-ledger-row:last-child {
  border-bottom: none;
}
.cc-ledger-row__icon {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.cc-ledger-row__body {
  flex: 1;
}
.cc-ledger-row__end {
  text-align: right;
}
</style>
