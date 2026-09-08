<template>
  <ion-page>
    <AppHeader title="Fund wallet" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <template v-if="stage === 'entry'">
          <section class="cc-topup__intro">
            <AppIcon name="add_card" :size="24" color="var(--cc-color-primary)" />
            <div>
              <h2>Add money to your wallet</h2>
              <p>
                Fund your CruxCare wallet by card or bank transfer, then pay for anything in the app
                from your balance.
              </p>
            </div>
          </section>

          <AppCard v-if="wallet" class="cc-topup__balance">
            <span>AVAILABLE BALANCE</span>
            <MoneyAmount :value="wallet.available" :currency="wallet.currency" size="display" />
          </AppCard>

          <AppInput
            v-model="amount"
            label="Amount to add"
            type="number"
            inputmode="decimal"
            :placeholder="`Minimum ${formattedMinimum}`"
            helper="Any processing charge is shown on the quote before you pay."
          />

          <div class="cc-topup__presets">
            <button
              v-for="preset in presets"
              :key="preset"
              type="button"
              class="cc-topup__preset"
              :class="{ 'cc-topup__preset--selected': Number(amount) === preset }"
              @click="amount = String(preset)"
            >
              <MoneyAmount :value="preset" :currency="currency" />
            </button>
          </div>

          <!-- The wallet is held in USD; a supported country is charged in its
               own currency at the gateway. Never converted here — the server
               prices the charge and the intent reports what it will be. -->
          <div v-if="chargeCurrency" class="cc-topup__notice">
            <AppIcon name="currency_exchange" :size="20" color="var(--cc-color-primary)" />
            <p>
              Your wallet is credited in {{ currency }}. You will be charged in
              {{ chargeCurrency.currency }} ({{ chargeCurrency.country }}) — the exact figure is on
              the quote before you pay.
            </p>
          </div>

          <div v-else-if="fundingBlocked" class="cc-topup__blocked">
            <AppIcon name="error" :size="20" color="var(--cc-color-warning-text)" />
            <p>
              Funding is unavailable for your currency right now because we have no rate for it.
              Please try again shortly.
            </p>
          </div>

          <div class="cc-text-body-strong" style="font-size: 14.5px">How would you like to pay?</div>
          <div class="cc-pay">
            <button
              v-for="option in methods"
              :key="option.channel"
              type="button"
              class="cc-pay__option"
              :class="{ 'cc-pay__option--selected': channel === option.channel }"
              @click="channel = option.channel"
            >
              <AppIcon
                :name="option.icon"
                :size="22"
                :color="channel === option.channel ? 'var(--cc-color-primary)' : 'var(--cc-ink-600)'"
              />
              <div class="cc-pay__body">
                <div class="cc-text-body-strong" style="font-size: 14.5px">{{ option.label }}</div>
                <div class="cc-text-caption">{{ option.detail }}</div>
              </div>
              <AppIcon
                v-if="channel === option.channel"
                name="check_circle"
                :size="20"
                color="var(--cc-color-primary)"
              />
            </button>
          </div>
        </template>

        <template v-else-if="stage === 'review' && quote">
          <div class="cc-topup__eyebrow">SERVER QUOTE</div>
          <h2 class="cc-topup__title">Review before you pay</h2>
          <AppCard class="cc-topup__quote">
            <div>
              <span>Added to wallet</span>
              <MoneyAmount :value="quote.walletCreditedWith" :currency="quote.currency" />
            </div>
            <div v-if="quote.fee > 0">
              <span>Processing charge</span>
              <MoneyAmount :value="quote.fee" :currency="quote.currency" />
            </div>
            <!-- What the sheet charges leads, because that is the figure that
                 leaves the payer's account; the USD total stays alongside
                 because that is what the wallet is priced in. -->
            <div class="cc-topup__quote-total">
              <span>You pay</span>
              <div class="cc-topup__figure">
                <MoneyAmount
                  :value="quote.local?.totalCharge ?? quote.totalCharge"
                  :currency="quote.local?.totalCharge != null ? quote.local.currency : quote.currency"
                />
                <MoneyAmount
                  v-if="quote.local?.totalCharge != null"
                  :value="quote.totalCharge"
                  :currency="quote.currency"
                  class="cc-topup__alt"
                />
              </div>
            </div>
            <div>
              <span>Wallet after funding</span>
              <MoneyAmount :value="quote.balanceAfter" :currency="quote.currency" />
            </div>
            <div><span>Paying by</span><strong>{{ selectedMethod.label }}</strong></div>
          </AppCard>
          <p v-if="quote.local" class="cc-topup__rate">
            Charged in {{ quote.local.currency }} at
            {{ formatMoney(quote.local.rate, quote.local.currency) }} per
            {{ formatMoney(1, quote.currency) }}<template v-if="quote.local.rateSource === 'system'">, an indicative rate</template>.
            Your wallet is credited in {{ quote.currency }}.
          </p>
          <div class="cc-topup__notice">
            <AppIcon name="lock" :size="20" color="var(--cc-color-primary)" />
            <p>
              Your card or account details are entered in our payment provider's own sheet and never
              reach CruxCare. Your balance updates once the payment is confirmed.
            </p>
          </div>
        </template>

        <template v-else-if="confirmation">
          <section class="cc-topup__result">
            <div>
              <AppIcon
                :name="settled ? 'check_circle' : 'schedule'"
                :size="33"
                :color="settled ? 'var(--cc-color-success)' : 'var(--cc-color-warning-text)'"
              />
            </div>
            <div class="cc-topup__eyebrow">
              {{ settled ? 'FUNDS ADDED' : 'AWAITING CONFIRMATION' }}
            </div>
            <h2>{{ settled ? 'Your wallet has been funded' : 'Your payment is being confirmed' }}</h2>
            <p>{{ confirmation.message }}</p>
          </section>
          <AppCard class="cc-topup__receipt">
            <span v-if="confirmation.amountPaid !== null">AMOUNT PAID</span>
            <MoneyAmount
              v-if="confirmation.amountPaid !== null"
              :value="confirmation.amountPaid"
              :currency="confirmation.currency"
              size="display"
            />
            <span>REFERENCE</span>
            <strong>{{ confirmation.reference }}</strong>
            <small>CruxCare confirms every payment with the provider before crediting a wallet.</small>
          </AppCard>
        </template>
      </div>
    </ion-content>

    <ion-footer class="cc-topup__footer">
      <AppButton
        v-if="stage === 'entry'"
        :loading="quoting"
        :disabled="!canQuote"
        @click="requestQuote"
      >
        Review quote
      </AppButton>
      <template v-else-if="stage === 'review'">
        <AppButton variant="secondary" @click="stage = 'entry'">Edit</AppButton>
        <AppButton :loading="paying" @click="pay">Pay {{ payLabel }}</AppButton>
      </template>
      <AppButton v-else @click="router.back()">Done</AppButton>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonFooter, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { AppButton, AppCard, AppHeader, AppIcon, AppInput, MoneyAmount } from '@/components/ui';
import { walletApi } from '@/api/wallet.api';
import { paymentsApi } from '@/api/payments.api';
import { PaymentUnavailableError, resolvePaymentProvider } from '@/services/payment';
import { useWallet } from '@/composables/useWallet';
import { useMyCurrency } from '@/composables/useCurrencies';
import { useToast } from '@/composables/useToast';
import { formatMoney } from '@/utils/money';
import { ApiError } from '@/types/api';
import type { PaymentChannel, PaymentConfirmation } from '@/types/payments';
import type { WalletTopUpQuote } from '@/types/wallet';

/**
 * Funding the wallet from a card or bank transfer. Open to every role — a
 * therapist paying for a plan and a member contributing to the cooperative
 * spend from the same balance, so neither can be asked to fund it elsewhere.
 *
 * The device never prices anything: the server quotes the charge, mints the
 * payment reference, and decides whether the money arrived. What the gateway
 * sheet reported is only a hint for choosing the next screen.
 */
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();
const { data: wallet } = useWallet();

const MINIMUM_TOP_UP = 5;
const presets = [10, 25, 50, 100];

const amount = ref('');
const channel = ref<PaymentChannel>('card');
const stage = ref<'entry' | 'review' | 'done'>('entry');
const quote = ref<WalletTopUpQuote | null>(null);
const confirmation = ref<PaymentConfirmation | null>(null);
const quoting = ref(false);
const paying = ref(false);

const methods: { channel: PaymentChannel; label: string; detail: string; icon: string }[] = [
  {
    channel: 'card',
    label: 'Card',
    detail: "Debit or credit card, entered in our provider's secure sheet",
    icon: 'credit_card',
  },
  {
    channel: 'bank-transfer',
    label: 'Bank transfer',
    detail: 'Transfer to the account our provider shows you',
    icon: 'account_balance',
  },
];

const currency = computed(() => wallet.value?.currency ?? 'USD');

/**
 * The currency the gateway will charge in, resolved server-side from the
 * user's profile. Null for anyone with no supported country — most users —
 * who are simply charged in USD and see none of this.
 */
const { mine, canFundInLocalCurrency } = useMyCurrency();
const chargeCurrency = computed(() => (canFundInLocalCurrency.value ? mine.value : null));

/**
 * A country can be supported but temporarily unpriced. Opening a payment
 * without a rate would misprice it, so funding stops rather than guessing.
 */
const fundingBlocked = computed(() => mine.value !== null && !mine.value.fundable);
const selectedMethod = computed(() => methods.find((m) => m.channel === channel.value)!);
const canQuote = computed(() => Number(amount.value) >= MINIMUM_TOP_UP && !fundingBlocked.value);
const settled = computed(() => confirmation.value?.status === 'settled');

const formattedMinimum = computed(() => formatMoney(MINIMUM_TOP_UP, currency.value));
/** The button quotes the figure that will leave the payer's account. */
const payLabel = computed(() => {
  const current = quote.value;
  if (!current) return '';
  return current.local?.totalCharge != null
    ? formatMoney(current.local.totalCharge, current.local.currency)
    : formatMoney(current.totalCharge, current.currency);
});

async function requestQuote() {
  if (!canQuote.value) return;
  quoting.value = true;
  try {
    quote.value = await walletApi.quoteTopUp(Number(amount.value));
    stage.value = 'review';
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error
        : 'We could not price that top-up. Please try again.';
    await toast.show(message, 'warning', { title: 'Could not quote' });
  } finally {
    quoting.value = false;
  }
}

async function pay() {
  const current = quote.value;
  if (!current) return;

  paying.value = true;
  try {
    const intent = await paymentsApi.createIntent({
      purpose: 'wallet-topup',
      subject: current.id,
      expectedAmount: current.totalCharge,
      expectedCurrency: current.currency,
      channel: channel.value,
    });

    // The server names the gateway that minted this reference, so the sheet
    // that opens is the one that can actually settle it.
    const provider = resolvePaymentProvider(intent.gateway);

    const result = await provider.collectPayment({
      reference: intent.reference,
      amount: intent.amount,
      currency: intent.currency,
      description: intent.description,
      customerName: intent.customerName,
      customerEmail: intent.customerEmail,
      gateway: intent.gateway,
      channel: channel.value,
    });

    if (result.outcome === 'cancelled') {
      await toast.show('No payment was taken. Your wallet is unchanged.', 'info', {
        title: 'Payment cancelled',
      });
      return;
    }

    if (result.outcome === 'failed') {
      await toast.show(
        result.message ?? 'That payment did not go through. Please try again.',
        'danger',
        { title: 'Payment failed', dismissLabel: 'Try again' },
      );
      return;
    }

    // `authorized` is what the sheet observed, not proof of funds: only the
    // API's confirmation decides whether the wallet gets credited.
    confirmation.value = await paymentsApi.confirm(intent.reference, result.gatewayReference);
    if (confirmation.value.status === 'failed') {
      await toast.show(confirmation.value.message, 'danger', { title: 'Payment failed' });
      return;
    }

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['wallet'] }),
      queryClient.invalidateQueries({ queryKey: ['wallet', 'ledger'] }),
    ]);
    stage.value = 'done';
  } catch (error) {
    // A provider error means no sheet could be opened at all — its message
    // says why, and repeating the attempt will not help.
    if (error instanceof PaymentUnavailableError) {
      await toast.show(error.message, 'danger', { title: 'Payment unavailable' });
      return;
    }

    const message =
      error instanceof ApiError
        ? error
        : 'We could not start that payment. Please try again.';
    await toast.show(message, 'danger', { title: 'Payment failed', dismissLabel: 'Try again' });
  } finally {
    paying.value = false;
  }
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
.cc-topup__intro {
  display: flex;
  gap: 12px;
}
.cc-topup__intro h2 {
  margin: 0 0 4px;
  font-family: var(--cc-font-interface);
  font-size: var(--cc-text-h1-size);
  line-height: var(--cc-text-h1-line);
  font-weight: var(--cc-text-h1-weight);
}
.cc-topup__intro p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 18px;
  color: var(--cc-ink-600);
}
.cc-topup__balance span {
  display: block;
  margin-bottom: 4px;
  color: var(--cc-color-primary);
  font-family: var(--cc-font-interface);
  font-size: 10.5px;
  letter-spacing: 0.04em;
}
.cc-topup__presets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.cc-topup__preset {
  padding: 10px 4px;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-md);
  background: var(--cc-surface-0);
  cursor: pointer;
}
.cc-topup__preset--selected {
  border: 1.5px solid var(--cc-color-primary);
  background: var(--cc-color-mist);
}
.cc-topup__preset :deep(.cc-money) {
  font-size: 13px;
}
.cc-pay {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-pay__option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-lg);
  background: var(--cc-surface-0);
  text-align: left;
  cursor: pointer;
}
.cc-pay__option--selected {
  border: 1.5px solid var(--cc-color-primary);
  background: var(--cc-color-mist);
}
.cc-pay__body {
  flex: 1;
  min-width: 0;
}
.cc-topup__eyebrow {
  font-family: var(--cc-font-interface);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--cc-color-primary);
}
.cc-topup__title {
  margin: 2px 0 0;
  font-family: var(--cc-font-interface);
  font-size: var(--cc-text-h1-size);
  line-height: var(--cc-text-h1-line);
  font-weight: var(--cc-text-h1-weight);
}
.cc-topup__quote > div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  padding: 9px 0;
  border-bottom: 1px solid var(--cc-divider);
  font-family: var(--cc-font-interface);
  font-size: 13.5px;
  color: var(--cc-ink-600);
}
.cc-topup__quote > div:last-child {
  border-bottom: none;
}
.cc-topup__quote-total {
  font-weight: 600;
  color: var(--cc-ink-900);
}
.cc-topup__figure {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}
.cc-topup__quote :deep(.cc-money.cc-topup__alt) {
  color: var(--cc-ink-400);
  font-size: 11px;
  font-weight: 400;
}
.cc-topup__rate {
  margin: 0;
  color: var(--cc-ink-400);
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 16px;
}
.cc-topup__notice {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: var(--cc-radius-md);
  background: var(--cc-color-mist);
}
.cc-topup__blocked {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: var(--cc-radius-md);
  background: var(--cc-color-warning-tint);
}
.cc-topup__blocked p {
  margin: 0;
  color: var(--cc-color-warning-text);
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 17px;
}
.cc-topup__notice p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 17px;
  color: var(--cc-ink-600);
}
.cc-topup__result {
  text-align: center;
  padding: 12px 0 0;
}
.cc-topup__result h2 {
  margin: 4px 0 6px;
  font-family: var(--cc-font-interface);
  font-size: var(--cc-text-h1-size);
  line-height: var(--cc-text-h1-line);
  font-weight: var(--cc-text-h1-weight);
}
.cc-topup__result p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 18px;
  color: var(--cc-ink-600);
}
.cc-topup__receipt {
  text-align: center;
}
.cc-topup__receipt span {
  display: block;
  font-family: var(--cc-font-interface);
  font-size: 10.5px;
  letter-spacing: 0.04em;
  color: var(--cc-ink-400);
}
.cc-topup__receipt strong {
  display: block;
  margin: 4px 0;
  font-family: var(--cc-font-mono);
  font-size: 15px;
}
.cc-topup__receipt small {
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  color: var(--cc-ink-400);
}
.cc-topup__footer {
  display: flex;
  gap: 10px;
  padding: 11px 16px calc(16px + env(safe-area-inset-bottom));
  background: var(--cc-surface-0);
  border-top: 1px solid var(--cc-divider);
}
</style>
