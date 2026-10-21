<template>
  <ion-page>
    <AppHeader title="Earnings" :botanical="false" />
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['wallet'], ['therapist', 'earnings']]" />
      <LoadingState v-if="isPending" label="Loading your earnings…" />

      <ErrorState
        v-else-if="isError && !earnings"
        title="We could not load your earnings"
        message="Nothing has changed. Check your connection and try again."
      >
        <template #actions>
          <AppButton variant="secondary" @click="refetch()">Try again</AppButton>
        </template>
      </ErrorState>

      <div v-else class="cc-screen__pad">
        <!-- Cash leads because it is the money that can actually leave, and
             pending sits beside it rather than under a tap: `available: 0` next
             to `pending: 66.15` is a normal state for a therapist whose client
             is midway through paying, and the single most likely figure on this
             screen to be read as a bug. -->
        <section class="cc-earn__headline" aria-label="Your earnings">
          <span class="cc-earn__eyebrow">READY TO WITHDRAW</span>
          <MoneyAmount :value="cashAvailable" :currency="currency" size="display" />
          <p v-if="cashPending > 0" class="cc-earn__pending">
            <AppIcon name="schedule" :size="16" color="#cde7e1" />
            <span>
              <MoneyAmount :value="cashPending" :currency="currency" /> still clearing — it lands
              when your client finishes paying for their course.
            </span>
          </p>
          <p v-else class="cc-earn__pending cc-earn__pending--quiet">
            Your share is written the moment a client pays, and clears when their course is paid off.
          </p>
        </section>

        <!-- The rate, and the gap between it and what arrives. "You earn 50%"
             and "$94.50 landed" are both true, and a screen that shows one
             without the other reads as a 10% shortfall nobody mentioned. -->
        <AppCard v-if="summary" class="cc-earn__rate">
          <div class="cc-earn__rate-row">
            <span class="cc-text-caption">Your share of each treatment plan</span>
            <span class="cc-text-body-strong">{{ summary.ratePercent }}%</span>
          </div>
          <div class="cc-earn__rate-row">
            <span class="cc-text-caption">Held back into loyalty</span>
            <span class="cc-text-body-strong">{{ summary.loyaltyPercent }}%</span>
          </div>
          <p class="cc-earn__rate-note">
            The loyalty share is taken out of what you earn, not added on top — the two always sum
            to your full {{ summary.ratePercent }}%. Products earn nothing: CruxCare sources and
            ships those.
          </p>
        </AppCard>

        <div class="cc-earn__tiles">
          <div class="cc-earn__tile">
            <span class="cc-text-caption">Still to clear</span>
            <MoneyAmount :value="minor(summary?.accruedMinor)" :currency="currency" />
          </div>
          <div class="cc-earn__tile">
            <span class="cc-text-caption">Loyalty</span>
            <MoneyAmount :value="minor(summary?.loyaltyDueMinor)" :currency="currency" />
          </div>
          <div class="cc-earn__tile">
            <span class="cc-text-caption">Earned all time</span>
            <MoneyAmount :value="minor(summary?.lifetimeMinor)" :currency="currency" />
          </div>
        </div>

        <!-- Requesting and being paid are different acts on different days, so
             the strip says both rather than only whether the button works. -->
        <div
          v-if="windowLine"
          class="cc-earn__window"
          :class="{ 'cc-earn__window--shut': window && !window.open }"
        >
          <AppIcon
            name="calendar_month"
            :size="20"
            :color="window && !window.open ? 'var(--cc-color-warning-text)' : 'var(--cc-color-primary)'"
          />
          <p>{{ windowLine }}</p>
        </div>

        <AppButton :disabled="!canWithdraw" @click="goWithdraw">
          {{ withdrawLabel }}
        </AppButton>

        <div class="cc-text-body-strong" style="font-size: 16px">Where it came from</div>
        <EmptyState
          v-if="!rows.length"
          icon="payments"
          title="No earnings yet"
          message="Your share of a client's treatment lands here the moment they pay."
        />
        <AppCard v-else style="padding: 0">
          <div v-for="row in rows" :key="row.id" class="cc-earn__row">
            <div class="cc-earn__row-body">
              <div class="cc-earn__row-top">
                <span class="cc-text-body-strong" style="font-size: 14.5px">{{ row.who }}</span>
                <AppBadge :label="row.statusLabel" :tone="row.statusTone" />
              </div>
              <!-- The arithmetic, because the headline rate and the figure that
                   arrives are different numbers and the difference is the
                   reserve, not a deduction nobody explained. -->
              <div class="cc-text-caption">{{ row.workings }}</div>
            </div>
            <div class="cc-earn__row-end">
              <MoneyAmount :value="row.cash" :currency="row.currency" />
              <span v-if="row.loyalty > 0" class="cc-text-caption">
                + <MoneyAmount :value="row.loyalty" :currency="row.currency" /> loyalty
              </span>
            </div>
          </div>
        </AppCard>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import {
  AppBadge,
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppPullToRefresh,
  MoneyAmount,
} from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/state';
import { useTherapistEarnings, useWallet } from '@/composables/useWallet';
import { purseOf, windowSummary } from '@/features/wallet/walletPurses';
import { formatMinor } from '@/utils/money';
import type { TherapistEarning } from '@/types/earnings';

/**
 * TD6 · What a therapist has earned, and where it came from.
 *
 * This screen used to show the *e-wallet's* available balance under the words
 * "AVAILABLE EARNINGS" — a figure that has nothing to do with earnings, since
 * the e-wallet holds funded money and earnings land in cash. It now reads the
 * cash purse and the per-payment breakdown behind it.
 */
const router = useRouter();
const { data: wallet } = useWallet();
const { data: earnings, isPending, isError, refetch } = useTherapistEarnings();

const cash = computed(() => purseOf(wallet.value, 'cash'));
const summary = computed(() => earnings.value?.meta?.summary ?? null);

/** The purse's own currency where there is one, then the wallet's. Never a
 *  literal: which currency a balance is held in is not the app's to assume. */
const currency = computed(
  () => cash.value?.currency ?? summary.value?.currency ?? wallet.value?.currency ?? 'USD',
);

const cashAvailable = computed(() => cash.value?.available ?? 0);
const cashPending = computed(() => cash.value?.pending ?? minor(summary.value?.accruedMinor));

/** Server-sent, and repeated on the earnings payload so this screen needs no
 *  second call for it. */
const window = computed(
  () => earnings.value?.meta?.withdrawalWindow ?? wallet.value?.withdrawalWindow,
);
const windowLine = computed(() => windowSummary(window.value));

/**
 * Both conditions, because they fail differently: a shut window is "come back
 * Tuesday" and an empty cash purse is "nothing has cleared yet". The button is
 * disabled either way, and the label says which.
 */
const canWithdraw = computed(
  () => cashAvailable.value > 0 && (window.value?.open ?? true),
);

const withdrawLabel = computed(() => {
  if (window.value && !window.value.open) return 'Withdrawals are closed right now';
  if (cashAvailable.value <= 0) return 'Nothing has cleared yet';
  return 'Withdraw earnings';
});

function minor(value: number | undefined): number {
  return (value ?? 0) / 100;
}

const STATUS_LABELS: Record<string, { label: string; tone: 'success' | 'warning' | 'default' }> = {
  due: { label: 'CLEARED', tone: 'success' },
  accrued: { label: 'CLEARING', tone: 'warning' },
};

const rows = computed(() =>
  (earnings.value?.data ?? []).map((earning) => {
    const status = STATUS_LABELS[earning.status] ?? { label: String(earning.status).toUpperCase(), tone: 'default' as const };
    return {
      id: earning.id,
      who: whoFor(earning),
      statusLabel: status.label,
      statusTone: status.tone,
      workings: workingsFor(earning),
      cash: earning.cashMinor / 100,
      loyalty: earning.loyaltyMinor / 100,
      currency: earning.currency ?? currency.value,
    };
  }),
);

/** The client where the server names them; otherwise the case, which is at
 *  least something the therapist can look up. */
function whoFor(earning: TherapistEarning): string {
  if (earning.clientName?.trim()) return earning.clientName;
  return `Case ${earning.caseId}`;
}

function workingsFor(earning: TherapistEarning): string {
  const base = formatMinor(earning.baseMinor, earning.currency ?? currency.value);
  const gross = formatMinor(earning.grossMinor, earning.currency ?? currency.value);
  const of = earning.basis === 'extension' ? 'extra visits' : 'treatment';
  return `${earning.ratePercent}% of ${base} ${of} · ${gross}`;
}

function goWithdraw() {
  router.push({ name: 'wallet-withdraw', query: { wallet: 'cash' } });
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

.cc-earn__headline {
  padding: 18px;
  border-radius: var(--cc-radius-lg);
  background: var(--cc-color-primary-dark);
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #fff;
}
.cc-earn__eyebrow {
  font-family: var(--cc-font-interface);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: #9bd2c8;
}
.cc-earn__headline :deep(.cc-money) {
  color: #fff;
}
.cc-earn__pending {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  margin: 2px 0 0;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 18px;
  color: #cde7e1;
}
.cc-earn__pending--quiet {
  color: #a9cfc7;
}

.cc-earn__rate {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cc-earn__rate-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.cc-earn__rate-note {
  margin: 4px 0 0;
  font-family: var(--cc-font-interface);
  font-size: 12px;
  line-height: 18px;
  color: var(--cc-ink-400);
}

.cc-earn__tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.cc-earn__tile {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 11px 12px;
  border-radius: var(--cc-radius-sm);
  border: 1px solid var(--cc-line);
  background: var(--cc-surface-0);
  min-width: 0;
}

.cc-earn__window {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 12px 14px;
  border-radius: var(--cc-radius-lg);
  background: var(--cc-color-mist);
}
.cc-earn__window--shut {
  background: var(--cc-color-warning-tint);
}
.cc-earn__window p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 18px;
  color: var(--cc-ink-600);
}

.cc-earn__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 14px;
  border-bottom: 1px solid var(--cc-divider);
}
.cc-earn__row:last-child {
  border-bottom: none;
}
.cc-earn__row-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}
.cc-earn__row-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.cc-earn__row-end {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}
</style>
