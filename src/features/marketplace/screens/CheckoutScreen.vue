<template>
  <ion-page>
    <AppHeader title="Checkout" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
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

        <div class="cc-text-body-strong" style="font-size: 16px; margin-top: 8px">Payment</div>
        <button
          type="button"
          class="cc-option cc-option--row"
          :class="{ 'cc-option--selected': payment === 'wallet' }"
          @click="payment = 'wallet'"
        >
          <AppIcon name="account_balance_wallet" :size="22" color="var(--cc-color-primary)" />
          <div class="cc-option__body">
            <div class="cc-text-body-strong" style="font-size: 14.5px">CruxCare wallet</div>
            <div class="cc-text-caption">
              <MoneyAmount v-if="wallet" :value="wallet.available" :currency="wallet.currency" size="mono" />
              available
            </div>
          </div>
        </button>
      </div>

      <div class="cc-screen__footer">
        <AppButton :loading="quoting" @click="openSummary">
          Checkout<template v-if="cart.cart"> · <MoneyAmount :value="cart.cart.subtotal" :currency="cart.cart.currency" /></template>
        </AppButton>
      </div>
    </ion-content>

    <AppSheet v-model="sheetOpen" title="Confirm your order">
      <p class="cc-text-body" style="margin: 0 0 16px">
        Priced by CruxCare just now · stock reserved for 10 minutes.
      </p>
      <div v-if="quote" class="cc-summary">
        <div class="cc-summary__row">
          <span class="cc-text-body">{{ cart.cart?.items.length }} item(s)</span>
          <MoneyAmount :value="quote.subtotal" :currency="quote.currency" />
        </div>
        <div class="cc-summary__divider" />
        <div class="cc-summary__row cc-summary__row--total">
          <span class="cc-text-body-strong">Paying from wallet</span>
          <MoneyAmount :value="quote.total" :currency="quote.currency" size="display" />
        </div>
        <div class="cc-summary__row">
          <span class="cc-text-caption">Wallet after payment</span>
          <MoneyAmount :value="quote.walletBalanceAfter" :currency="quote.currency" size="mono" />
        </div>
      </div>
      <AppButton :loading="placing" style="margin-bottom: 8px" @click="placeOrder">Place order</AppButton>
      <AppButton variant="text" @click="sheetOpen = false">Back to cart</AppButton>
    </AppSheet>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppButton, AppHeader, AppIcon, AppSheet, MoneyAmount } from '@/components/ui';
import { ordersApi } from '@/api/orders.api';
import { newIdempotencyKey } from '@/api/client';
import { useCartStore } from '@/stores/cart';
import { useWallet } from '@/composables/useWallet';
import { paymentProvider } from '@/services/payment/PaymentProvider';
import { useConnectivityStore } from '@/stores/connectivity';
import { useToast } from '@/composables/useToast';
import type { CheckoutQuote } from '@/types/marketplace';

/** C4 · Checkout ⧉ summary sheet — server-priced totals, resulting wallet
 * balance shown before paying, never an optimistic success. */
const router = useRouter();
const cart = useCartStore();
const connectivity = useConnectivityStore();
const toast = useToast();
const { data: wallet } = useWallet();

const delivery = ref<'home' | 'pickup'>('home');
const payment = ref<'wallet'>('wallet');
const sheetOpen = ref(false);
const quoting = ref(false);
const placing = ref(false);
const quote = ref<CheckoutQuote | null>(null);
const idempotencyKey = newIdempotencyKey();

async function openSummary() {
  if (!connectivity.online) {
    await toast.show('Money actions are paused while offline.', 'warning');
    return;
  }
  quoting.value = true;
  try {
    quote.value = await ordersApi.quoteCheckout();
    sheetOpen.value = true;
  } finally {
    quoting.value = false;
  }
}

async function placeOrder() {
  placing.value = true;
  try {
    const { token } = await paymentProvider.collectPaymentMethod();
    const order = await ordersApi.checkout(idempotencyKey, token);
    cart.clear();
    router.replace({ name: 'order-confirmed', params: { id: order.id } });
  } finally {
    placing.value = false;
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
