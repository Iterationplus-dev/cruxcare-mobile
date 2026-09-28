<template>
  <AppCard v-if="bill" class="cc-bill">
    <div class="cc-bill__head">
      <span class="cc-text-body-strong">What this case costs</span>
      <span class="cc-text-caption">Treatment and products, priced and paid apart.</span>
    </div>

    <dl class="cc-bill__rows">
      <!-- A cadence proposed without a priced plan stores no treatment figure,
           so the bill genuinely has none yet. Rendering that as $0.00 next to a
           plan the client is about to be charged for would be a false
           statement about what this case costs. -->
      <div class="cc-bill__row">
        <dt>Treatment</dt>
        <dd v-if="treatmentPriced">
          <MoneyAmount :value="bill.treatmentTotal" :currency="bill.currency" />
        </dd>
        <dd v-else class="cc-bill__unpriced">Priced when you choose a plan</dd>
      </div>
      <div class="cc-bill__row">
        <dt>Products you accepted</dt>
        <dd><MoneyAmount :value="bill.productsTotal" :currency="bill.currency" /></dd>
      </div>
      <div class="cc-bill__row cc-bill__row--total">
        <dt>{{ treatmentPriced ? 'Total' : 'Products total' }}</dt>
        <dd><MoneyAmount :value="bill.total" :currency="bill.currency" /></dd>
      </div>
      <div v-if="bill.paidMinor > 0" class="cc-bill__row cc-bill__row--paid">
        <dt>Already paid</dt>
        <dd>−<MoneyAmount :value="bill.paid" :currency="bill.currency" /></dd>
      </div>
      <div v-if="bill.paidMinor > 0" class="cc-bill__row cc-bill__row--total">
        <dt>Still to pay</dt>
        <dd><MoneyAmount :value="bill.outstanding" :currency="bill.currency" /></dd>
      </div>
    </dl>

    <p v-if="!treatmentPriced" class="cc-bill__hint">
      Your visits are priced separately — choose a plan below and its cost is added here.
    </p>

    <template v-if="bill.outstandingMinor > 0">
      <!-- The schedule is the server's, rendered rather than computed: working
           out 70% on the device is how the two sides end up a cent apart on a
           bill somebody has to settle. -->
      <div v-if="schedule.length" class="cc-bill__steps">
        <div
          v-for="step in schedule"
          :key="step.key"
          class="cc-bill__step"
          :class="{ 'cc-bill__step--settled': step.outstandingMinor === 0 }"
        >
          <div class="cc-bill__step-text">
            <span class="cc-bill__step-label">{{ step.label }}</span>
            <span class="cc-bill__step-meta">{{ step.percent }}% · {{ stepWhen(step) }}</span>
          </div>
          <MoneyAmount :value="step.amountMinor / 100" :currency="bill.currency" />
          <!-- The balance cannot be paid before the deposit: doing so would
               leave treatment unable to start, which is the opposite of what
               the client was trying to do. The server refuses it; disabling it
               here saves them finding out by tapping. -->
          <AppButton
            v-if="step.outstandingMinor > 0"
            variant="secondary"
            :full-width="false"
            :disabled="awaitingDeposit(step)"
            :loading="paying === step.key"
            @click="pay(step.key)"
          >
            Pay
          </AppButton>
          <AppIcon v-else name="check_circle" :size="20" color="var(--cc-color-primary)" />
        </div>
      </div>

      <!-- Why the plan cannot be split, in the server's terms rather than ours.
           Only worth saying when there is a plan to split. -->
      <p v-else-if="treatmentPriced && instalmentBlocked" class="cc-bill__hint">
        {{ instalmentBlocked }}
      </p>

      <!-- Extra visits the therapist offered after the course started. Its own
           row rather than folded into treatment: the 70/30 schedule is a
           percentage of the treatment component, so adding a top-up there
           would re-price a deposit already paid. -->
      <div v-if="extensionsOutstandingMinor > 0" class="cc-bill__step">
        <div class="cc-bill__step-text">
          <span class="cc-bill__step-label">Extra visits</span>
          <span class="cc-bill__step-meta">Paid before they start</span>
        </div>
        <MoneyAmount :value="extensionsOutstandingMinor / 100" :currency="bill.currency" />
        <AppButton
          variant="secondary"
          :full-width="false"
          :loading="paying === 'extensions'"
          @click="pay('extensions')"
        >
          Pay
        </AppButton>
      </div>

      <!-- Goods being dispatched rather than care delivered over months, so
           this one never splits however the plan is being paid. -->
      <div v-if="productsOutstandingMinor > 0" class="cc-bill__step">
        <div class="cc-bill__step-text">
          <span class="cc-bill__step-label">Products</span>
          <span class="cc-bill__step-meta">Paid in full</span>
        </div>
        <MoneyAmount :value="productsOutstandingMinor / 100" :currency="bill.currency" />
        <AppButton
          variant="secondary"
          :full-width="false"
          :loading="paying === 'products'"
          @click="pay('products')"
        >
          Pay
        </AppButton>
      </div>

      <!-- Two buttons because a client on instalments owes two different
           figures. What is due today is this instalment plus the goods — the
           plan is spread over the course, the products are not — and settling
           that used to mean two trips through the card sheet for one decision.
           "Pay everything" still settles the instalment that is not due yet,
           which is a different choice and keeps its own button.

           Only shown when the two actually differ: with nothing outstanding
           beyond what is due now, it would be the same charge under two
           names. -->
      <AppButton
        v-if="dueNowWithProductsMinor > 0 && dueNowWithProductsMinor < bill.outstandingMinor"
        :loading="paying === 'due-plus-products'"
        @click="pay('due-plus-products')"
      >
        Pay what is due now ·
        <MoneyAmount :value="dueNowWithProductsMinor / 100" :currency="bill.currency" />
      </AppButton>

      <AppButton
        :variant="dueNowWithProductsMinor > 0 && dueNowWithProductsMinor < bill.outstandingMinor ? 'secondary' : 'primary'"
        :loading="paying === 'everything'"
        @click="pay('everything')"
      >
        Pay everything · <MoneyAmount :value="bill.outstanding" :currency="bill.currency" />
      </AppButton>
    </template>

    <p v-else class="cc-bill__settled">
      <AppIcon name="check_circle" :size="18" color="var(--cc-color-primary)" />
      <span>This case is paid up.</span>
    </p>

    <!-- The same statement the client acknowledged when accepting, repeated on
         the screen the money actually leaves from. Server-sent, so the two
         screens cannot drift apart. -->
    <p v-if="bill.productDisclaimer" class="cc-bill__disclaimer">{{ bill.productDisclaimer }}</p>
  </AppCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { AppButton, AppCard, AppIcon, MoneyAmount } from '@/components/ui';
import { useCaseBill } from '@/composables/useCaseFiles';
import { paymentsApi } from '@/api/payments.api';
import { PaymentUnavailableError, resolvePaymentProvider } from '@/services/payment';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';
import type { CasePaymentStep } from '@/types/care';
import type { CasePaymentItem } from '@/types/payments';

/**
 * What the client owes for one case, and the controls that settle it.
 *
 * Every figure and every rule here is the server's. The app names which piece
 * is being paid and never names a price, so there is no way to construct a
 * part-payment the rules do not allow.
 */
const props = defineProps<{ caseId: string }>();

const toast = useToast();
const queryClient = useQueryClient();
const { data: bill } = useCaseBill(() => props.caseId);

const paying = ref<CasePaymentItem | null>(null);

/** Zero is a real total once a plan is paid for, so "unpriced" cannot be read
 *  off the figure alone — an unpaid, unpriced plan is the case that matters. */
const treatmentPriced = computed(
  () => !!bill.value && (bill.value.treatmentTotalMinor > 0 || bill.value.paidMinor > 0),
);

/**
 * A step worth nothing is not a step. An unpriced plan still comes back with a
 * single 100% entry of zero, marked paid — rendering it tells the client they
 * have settled treatment they have not been charged for yet.
 */
const schedule = computed(() =>
  (bill.value?.payment?.schedule ?? []).filter((step) => step.amountMinor > 0),
);

const productsOutstandingMinor = computed(
  () => bill.value?.payment?.productsOutstandingMinor ?? bill.value?.productsOutstandingMinor ?? 0,
);

/**
 * What the client owes today: the instalment that is due plus every unpaid
 * product.
 *
 * Read off the bill, never added up here. Working it out on the device means
 * deciding which step is "due", and a device that decides the balance is due
 * before the deposit has just paid the plan in the wrong order — the same
 * reason `schedule` is rendered rather than computed. A server that does not
 * send the figure yet simply offers no such button.
 */
const dueNowWithProductsMinor = computed(
  // Null when nothing is due, which is the server saying "offer no button".
  () => bill.value?.payment?.dueNowWithProductsMinor ?? 0,
);

const extensionsOutstandingMinor = computed(
  () => bill.value?.payment?.extensionsOutstandingMinor ?? 0,
);

/** The server's own reason, turned into a sentence. An unrecognised one still
 *  says something true rather than nothing at all. */
const instalmentBlocked = computed(() => {
  const payment = bill.value?.payment;
  if (!payment || payment.instalmentsAvailable) return null;
  if (payment.instalmentsUnavailableReason === 'plan_shorter_than_minimum') {
    return `Courses longer than ${payment.minimumDurationDays} days can be split in two. Yours runs ${payment.planDurationDays}, so it is paid in one go.`;
  }
  return 'This course is paid in one go.';
});

/** Server dates are days, not moments — "29 Oct", not a time. */
function formatDue(iso: string) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function stepWhen(step: CasePaymentStep) {
  if (step.status === 'paid') return 'Paid';
  // Null on the deposit: it is due now rather than on a date.
  if (!step.dueAt) return 'Due now';
  return `${step.status === 'overdue' ? 'Was due' : 'Due'} ${formatDue(step.dueAt)}`;
}

function awaitingDeposit(step: CasePaymentStep) {
  if (step.key !== 'treatment-balance') return false;
  const deposit = schedule.value.find((s) => s.key === 'treatment-deposit');
  return !!deposit && deposit.outstandingMinor > 0;
}

async function pay(item: CasePaymentItem) {
  if (paying.value || !bill.value) return;

  paying.value = item;
  try {
    const intent = await paymentsApi.createIntent({
      purpose: 'case-balance',
      subject: props.caseId,
      // The piece, not the price. The server values it from the bill.
      item,
      expectedCurrency: bill.value.currency,
    });

    const provider = resolvePaymentProvider(intent.gateway);
    const result = await provider.collectPayment({
      reference: intent.reference,
      amount: intent.amount,
      currency: intent.currency,
      description: intent.description,
      customerName: intent.customerName,
      customerEmail: intent.customerEmail,
      gateway: intent.gateway,
    });

    if (result.outcome === 'cancelled') {
      await toast.show('No payment was taken.', 'info', { title: 'Payment cancelled' });
      return;
    }
    if (result.outcome === 'failed') {
      await toast.show(result.message ?? 'That payment did not go through.', 'danger', {
        title: 'Payment failed',
        dismissLabel: 'Try again',
      });
      return;
    }

    // `authorized` is what the sheet observed, not proof of funds. Until the
    // server has checked the reference with the gateway it does not know the
    // payment happened, so the bill would still show it due — which is exactly
    // what a client sees if this step is skipped.
    const confirmation = await paymentsApi.confirm(intent.reference, result.gatewayReference);

    if (confirmation.status === 'failed' || confirmation.status === 'cancelled') {
      await toast.show(confirmation.message, 'danger', { title: 'Payment failed' });
      return;
    }

    // Refetch before reporting anything: the bill is the record of what was
    // settled, and a success message over a stale figure is the same bug.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['case-bill'] }),
      queryClient.invalidateQueries({ queryKey: ['case-recommendations'] }),
      queryClient.invalidateQueries({ queryKey: ['care-subscription'] }),
      queryClient.invalidateQueries({ queryKey: ['case-files'] }),
    ]);

    // A gateway can take the money and settle later. Saying "received" then
    // would promise something the bill does not yet show.
    if (confirmation.status === 'pending') {
      await toast.show(confirmation.message, 'info', { title: 'Payment being confirmed' });
      return;
    }

    await toast.show(
      item === 'treatment-deposit'
        ? 'Your therapist can start your treatment now.'
        : 'Your balance has been updated.',
      'success',
      { title: 'Payment received' },
    );
  } catch (error) {
    if (error instanceof PaymentUnavailableError) {
      await toast.show(error.message, 'danger', { title: 'Payment unavailable' });
      return;
    }
    // Each of these means the bill moved since it was drawn, so refetch rather
    // than leave a control on screen that no longer applies.
    if (
      error instanceof ApiError &&
      ['nothing_outstanding', 'deposit_required_first', 'instalments_not_available'].includes(
        error.code ?? '',
      )
    ) {
      await queryClient.invalidateQueries({ queryKey: ['case-bill'] });
      await toast.show(error.message, 'warning', { title: 'That has changed' });
      return;
    }
    const message =
      error instanceof ApiError
        ? error.message
        : 'We could not start that payment. Please try again.';
    await toast.show(message, 'danger', { title: 'Payment failed', dismissLabel: 'Try again' });
  } finally {
    paying.value = null;
  }
}
</script>

<style scoped>
.cc-bill {
  display: flex;
  flex-direction: column;
  gap: 13px;
  margin-bottom: 18px;
}
.cc-bill__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cc-bill__rows {
  display: flex;
  flex-direction: column;
  gap: 7px;
  margin: 0;
}
.cc-bill__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.cc-bill__row dt {
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 13.5px;
}
.cc-bill__row dd {
  margin: 0;
  color: var(--cc-ink-900);
  font-size: 13.5px;
}
.cc-bill__row--total {
  padding-top: 7px;
  border-top: 1px solid var(--cc-divider);
}
.cc-bill__row--total dt,
.cc-bill__row--total dd {
  color: var(--cc-ink-900);
  font-weight: 600;
  font-size: 15px;
}
.cc-bill__row--paid dd {
  color: var(--cc-color-primary);
}
.cc-bill__unpriced {
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  font-weight: 400;
}

.cc-bill__steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cc-bill__step {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 13px;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-md);
  background: var(--cc-surface-0);
}
.cc-bill__step--settled {
  background: var(--cc-color-mist);
}
.cc-bill__step-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  /* Lets a long label wrap instead of pushing the amount off the row. */
  min-width: 0;
  flex: 1;
}
.cc-bill__step-label {
  color: var(--cc-ink-900);
  font-family: var(--cc-font-interface);
  font-size: 13.5px;
  font-weight: 600;
  line-height: 19px;
}
.cc-bill__step-meta {
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 16px;
}
.cc-bill__hint {
  margin: 0;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 12px;
  line-height: 17px;
}
.cc-bill__settled {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 13px;
}
.cc-bill__disclaimer {
  margin: 0;
  padding-top: 10px;
  border-top: 1px solid var(--cc-divider);
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 17px;
}
</style>
