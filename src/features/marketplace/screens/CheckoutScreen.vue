<template>
  <ion-page>
    <AppHeader title="Checkout" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <div v-if="resuming" class="cc-notice" role="status">
          <AppIcon name="hourglass_top" :size="20" color="var(--cc-color-primary)" />
          <p>Confirming your card payment, then placing your order…</p>
        </div>

        <div class="cc-text-body-strong" style="font-size: 16px">Delivery</div>
        <button
          type="button"
          class="cc-option"
          :class="{ 'cc-option--selected': delivery === 'home' }"
          @click="delivery = 'home'"
        >
          <div class="cc-text-body-strong" style="font-size: 14.5px">Home delivery · 2-3 days</div>
          <div class="cc-text-caption">Delivery address on file</div>
        </button>
        <button
          type="button"
          class="cc-option"
          :class="{ 'cc-option--selected': delivery === 'pickup' }"
          @click="delivery = 'pickup'"
        >
          <div class="cc-text-body-strong" style="font-size: 14.5px">Pick up at an outlet</div>
          <div class="cc-text-caption">CruxCare Centre · free</div>
        </button>
      </div>

      <div class="cc-screen__footer">
        <AppButton :loading="quoting" :disabled="resuming" @click="openSummary">
          Checkout<template v-if="cart.cart"> · <MoneyAmount :value="cart.cart.subtotal" :currency="cart.cart.currency" /></template>
        </AppButton>
      </div>
    </ion-content>

    <AppSheet v-model="sheetOpen" title="Confirm your order">
      <p class="cc-text-body" style="margin: 0 0 16px">
        Priced by CruxCare just now · stock reserved for 10 minutes.
      </p>
      <template v-if="quote">
        <div class="cc-summary">
          <div class="cc-summary__row">
            <span class="cc-text-body">{{ cart.cart?.items.length }} item(s)</span>
            <MoneyAmount :value="quote.subtotal" :currency="quote.currency" />
          </div>
          <div v-if="quote.fees" class="cc-summary__row">
            <span class="cc-text-body">Fees</span>
            <MoneyAmount :value="quote.fees" :currency="quote.currency" />
          </div>
          <div class="cc-summary__divider" />
          <div class="cc-summary__row cc-summary__row--total">
            <span class="cc-text-body-strong">Total</span>
            <MoneyAmount :value="quote.total" :currency="quote.currency" size="display" />
          </div>
        </div>

        <div class="cc-text-body-strong" style="font-size: 15px; margin-bottom: 8px">Pay with</div>
        <div class="cc-pay">
          <template v-for="option in quote.paymentMethods" :key="option">
            <button
              v-if="option === 'wallet'"
              type="button"
              class="cc-option cc-option--row"
              :class="{ 'cc-option--selected': method === 'wallet', 'cc-option--disabled': !quote.walletSufficient }"
              :disabled="!quote.walletSufficient || busy"
              :aria-pressed="method === 'wallet'"
              @click="method = 'wallet'"
            >
              <AppIcon name="account_balance_wallet" :size="22" color="var(--cc-color-primary)" />
              <div class="cc-option__body">
                <div class="cc-text-body-strong" style="font-size: 14.5px">CruxCare wallet</div>
                <div v-if="quote.walletSufficient" class="cc-text-caption">
                  Wallet after payment
                  <MoneyAmount :value="quote.walletBalanceAfter" :currency="quote.currency" size="mono" />
                </div>
                <div v-else class="cc-text-caption cc-shortfall">{{ quoteShortfall(quote) }}</div>
              </div>
            </button>
            <button
              v-else-if="option === 'card'"
              type="button"
              class="cc-option cc-option--row"
              :class="{ 'cc-option--selected': method === 'card' }"
              :disabled="busy"
              :aria-pressed="method === 'card'"
              @click="method = 'card'"
            >
              <AppIcon name="credit_card" :size="22" color="var(--cc-color-primary)" />
              <div class="cc-option__body">
                <div class="cc-text-body-strong" style="font-size: 14.5px">Debit or credit card</div>
                <div class="cc-text-caption">Entered in the secure payment sheet</div>
              </div>
            </button>
          </template>
          <button
            v-if="!quote.walletSufficient && quote.paymentMethods.includes('wallet')"
            type="button"
            class="cc-link"
            @click="goTopUp"
          >
            Top up your wallet instead
          </button>
        </div>
      </template>
      <AppButton
        :loading="busy"
        :disabled="!method"
        style="margin-bottom: 8px"
        @click="onPay"
      >
        {{ confirming ? 'Confirming payment…' : method === 'card' ? 'Pay by card' : 'Place order' }}
      </AppButton>
      <AppButton variant="text" :disabled="busy" @click="sheetOpen = false">Back to cart</AppButton>
    </AppSheet>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { AppButton, AppHeader, AppIcon, AppSheet, MoneyAmount } from '@/components/ui';
import { ordersApi } from '@/api/orders.api';
import { paymentsApi } from '@/api/payments.api';
import { newIdempotencyKey } from '@/api/client';
import { PaymentUnavailableError, resolvePaymentProvider } from '@/services/payment';
import { useCartStore } from '@/stores/cart';
import { useConnectivityStore } from '@/stores/connectivity';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';
import {
  checkoutFailure,
  endsPendingPayment,
  pendingOrderPayment,
  quoteShortfall,
  type CheckoutFailure,
  type PendingOrderPayment,
} from '@/features/marketplace/checkoutPayment';
import type { CheckoutPaymentMethod, CheckoutQuote, Order } from '@/types/marketplace';

/**
 * C4 · Checkout ⧉ summary sheet — server-priced totals, never an optimistic
 * success. An order is placed only once it is paid for: from a wallet the
 * quote says covers it, or by a card payment the server has confirmed. The
 * card is charged first and the order placed after.
 */
const router = useRouter();
const queryClient = useQueryClient();
const cart = useCartStore();
const connectivity = useConnectivityStore();
const toast = useToast();

const delivery = ref<'home' | 'pickup'>('home');
const method = ref<CheckoutPaymentMethod | null>(null);
const sheetOpen = ref(false);
const quoting = ref(false);
const placing = ref(false);
/** A settled-or-settling card payment is being turned into an order. */
const confirming = ref(false);
/** The same, for a payment left over from an earlier visit. */
const resuming = ref(false);
const busy = computed(() => placing.value || confirming.value);
const quote = ref<CheckoutQuote | null>(null);
/** One per quote: a retry of the same wallet order must find the same order. */
let walletOrderKey = newIdempotencyKey();

/** How often to ask again while a card payment is still `pending`. */
const CONFIRM_ATTEMPTS = 5;
const CONFIRM_INTERVAL_MS = 2000;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function loadQuote() {
  quote.value = await ordersApi.quoteCheckout();
  walletOrderKey = newIdempotencyKey();
  const offered = quote.value.paymentMethods.filter(
    (option) => option !== 'wallet' || quote.value?.walletSufficient,
  );
  if (!method.value || !offered.includes(method.value)) method.value = offered[0] ?? null;
}

async function openSummary() {
  if (!connectivity.online) {
    await toast.show('Money actions are paused while offline.', 'warning');
    return;
  }
  quoting.value = true;
  try {
    await loadQuote();
    sheetOpen.value = true;
  } catch (e) {
    await toast.show(e instanceof ApiError ? e : 'We could not price your order. Please try again.', 'danger', {
      title: 'Could not start checkout',
    });
  } finally {
    quoting.value = false;
  }
}

/** Leaves the cart as it is; the quote is fetched again on return. */
function goTopUp() {
  sheetOpen.value = false;
  void router.push({ name: 'wallet-top-up' });
}

async function onPay() {
  if (busy.value || !method.value) return;
  if (method.value === 'wallet') await payFromWallet();
  else await payByCard();
}

async function payFromWallet() {
  placing.value = true;
  try {
    await orderPlaced(await ordersApi.checkout(walletOrderKey, 'wallet'));
  } catch (e) {
    await handleFailure(checkoutFailure(e));
  } finally {
    placing.value = false;
  }
}

/**
 * The API prices the quote and mints the reference; the provider's own sheet
 * collects the card, so no card detail passes through this app. The reference
 * is saved before the sheet opens: from then on the card may be charged, and
 * the order must still be placed if the app is closed before it is.
 */
async function payByCard() {
  if (!quote.value) return;

  placing.value = true;
  let pending: PendingOrderPayment | null = null;
  try {
    const intent = await paymentsApi.createIntent({
      purpose: 'order',
      subject: quote.value.quoteId,
      channel: 'card',
    });
    pending = { reference: intent.reference, orderKey: newIdempotencyKey() };
    await pendingOrderPayment.save(pending);

    const provider = resolvePaymentProvider(intent.gateway);
    const result = await provider.collectPayment({
      reference: intent.reference,
      amount: intent.amount,
      currency: intent.currency,
      description: intent.description,
      customerName: intent.customerName,
      customerEmail: intent.customerEmail,
      gateway: intent.gateway,
      channel: 'card',
    });

    if (result.outcome === 'cancelled' || result.outcome === 'failed') {
      await pendingOrderPayment.clear();
      await toast.show(
        result.outcome === 'cancelled'
          ? 'No payment was taken and no order was placed.'
          : (result.message ?? 'That payment did not go through. Please try again.'),
        result.outcome === 'cancelled' ? 'info' : 'danger',
        { title: result.outcome === 'cancelled' ? 'Payment cancelled' : 'Payment failed', dismissLabel: 'Okay' },
      );
      return;
    }

    // `authorized` and `pending` are what the sheet saw, not proof of payment.
    placing.value = false;
    await finishCardOrder(pending, result.gatewayReference);
  } catch (e) {
    if (e instanceof PaymentUnavailableError) {
      if (pending) await pendingOrderPayment.clear();
      await toast.show(e.message, 'danger', { title: 'Payment unavailable' });
      return;
    }
    await handleFailure(checkoutFailure(e));
  } finally {
    placing.value = false;
  }
}

/**
 * Confirm, then place. `POST /orders` only accepts a payment the gateway has
 * confirmed, so a `pending` confirmation or a `409 payment_not_settled` means
 * ask again in a moment. If it still has not settled after that, the payment
 * stays saved and the next visit to checkout finishes the job.
 */
async function finishCardOrder(pending: PendingOrderPayment, gatewayReference: string | null): Promise<void> {
  confirming.value = true;
  try {
    for (let attempt = 0; attempt < CONFIRM_ATTEMPTS; attempt += 1) {
      if (attempt > 0) await wait(CONFIRM_INTERVAL_MS);

      const confirmation = await paymentsApi.confirm(pending.reference, gatewayReference);
      if (confirmation.status === 'failed' || confirmation.status === 'cancelled') {
        await pendingOrderPayment.clear();
        await toast.show(confirmation.message, 'danger', { title: 'Payment failed', dismissLabel: 'Okay' });
        return;
      }
      if (confirmation.status === 'pending') continue;

      try {
        await orderPlaced(await ordersApi.checkout(pending.orderKey, pending.reference));
        return;
      } catch (e) {
        const failure = checkoutFailure(e);
        if (failure.kind === 'not_settled') continue;
        await handleFailure(failure);
        return;
      }
    }

    await toast.show(
      'Your card payment is still being confirmed. Your order will be placed when you come back to checkout.',
      'info',
      { title: 'Payment being confirmed', dismissLabel: 'Okay' },
    );
  } catch (e) {
    // The card may well have been charged, so the payment stays saved unless
    // the API says it can never become an order.
    await handleFailure(checkoutFailure(e));
  } finally {
    confirming.value = false;
  }
}

async function orderPlaced(order: Order) {
  await pendingOrderPayment.clear();
  cart.clear();
  sheetOpen.value = false;
  void queryClient.invalidateQueries({ queryKey: ['wallet'] });
  void queryClient.invalidateQueries({ queryKey: ['orders'] });
  router.replace({ name: 'order-confirmed', params: { id: order.id } });
}

async function handleFailure(failure: CheckoutFailure) {
  if (endsPendingPayment(failure)) await pendingOrderPayment.clear();

  switch (failure.kind) {
    case 'shortfall':
      await refreshQuoteQuietly();
      method.value = quote.value?.paymentMethods.includes('card') ? 'card' : method.value;
      await toast.show(failure.message, 'warning', { title: 'Wallet balance too low' });
      return;
    case 'not_settled':
      await toast.show(
        'Your card payment is still being confirmed. Your order will be placed when you come back to checkout.',
        'info',
        { title: 'Payment being confirmed' },
      );
      return;
    case 'restart_payment':
      method.value = 'card';
      await toast.show(failure.message, 'warning', { title: 'Please pay again', dismissLabel: 'Okay' });
      return;
    case 'restart_checkout':
      sheetOpen.value = false;
      await cart.load().catch(() => undefined);
      await toast.show(failure.message, 'warning', { title: 'Please check out again', dismissLabel: 'Okay' });
      return;
    case 'refunded':
      sheetOpen.value = false;
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      await cart.load().catch(() => undefined);
      router.replace({ name: 'cart' });
      await toast.show(failure.message, 'warning', { title: 'Order not placed — refunded', dismissLabel: 'Okay' });
      return;
    case 'refresh':
      await cart.load().catch(() => undefined);
      await refreshQuoteQuietly();
      await toast.show(failure.message, 'warning', { title: 'Your cart has changed' });
      return;
    case 'other':
      await toast.show(
        failure.error instanceof ApiError ? failure.error : 'We could not place your order. Please try again.',
        'danger',
        { title: 'Order not placed', dismissLabel: 'Try again' },
      );
  }
}

async function refreshQuoteQuietly() {
  try {
    await loadQuote();
  } catch {
    sheetOpen.value = false;
  }
}

/** A card payment from an earlier visit that never became an order. */
onMounted(async () => {
  const pending = await pendingOrderPayment.load();
  if (!pending) return;
  resuming.value = true;
  try {
    await finishCardOrder(pending, null);
  } finally {
    resuming.value = false;
  }
});
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-option {
  background: var(--cc-surface-0);
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-lg);
  padding: 14px;
  text-align: left;
  cursor: pointer;
  display: block;
}
.cc-option--row {
  display: flex;
  gap: 12px;
  align-items: center;
}
.cc-option__body {
  flex: 1;
}
.cc-option--selected {
  border: 1.5px solid var(--cc-color-primary);
}
.cc-option--disabled {
  cursor: not-allowed;
  opacity: 0.65;
}
.cc-pay {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
}
.cc-shortfall {
  color: var(--cc-error-surface-text);
}
.cc-link {
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0;
  font-family: var(--cc-font-interface);
  font-size: 13px;
  color: var(--cc-color-primary);
  text-decoration: underline;
  cursor: pointer;
}
.cc-notice {
  display: flex;
  gap: 10px;
  padding: 13px 14px;
  border-radius: 14px;
  background: var(--cc-color-mist);
}
.cc-notice p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 19px;
  color: var(--cc-ink-600);
}
.cc-screen__footer {
  padding: 11px 14px calc(25px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
.cc-summary {
  background: var(--cc-surface-app);
  border-radius: var(--cc-radius-md);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}
.cc-summary__row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.cc-summary__divider {
  height: 1px;
  background: var(--cc-line);
}
</style>
