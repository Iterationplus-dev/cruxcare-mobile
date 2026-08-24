<template>
  <ion-page>
    <ion-header class="cc-plain-header">
      <ion-toolbar class="cc-plain-header__bar">
        <ion-buttons slot="start"><ion-back-button :default-href="backHref" text="" /></ion-buttons>
        <ion-title>{{ onboarding ? 'Verification · step 2 of 2' : 'Therapist plan' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <div v-if="onboarding" class="cc-progress-track"><div class="cc-progress-fill" style="width: 100%" /></div>
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <h2 class="cc-text-h1" style="margin: 0 0 6px">
          {{ currentPlanLabel ? 'Change your plan' : 'Choose a therapist plan' }}
        </h2>
        <p class="cc-text-body" style="margin: 0 0 16px; font-size: 12.5px">
          <template v-if="currentPlanLabel">
            You are on the {{ currentPlanLabel }} plan. Purchases stay unlimited on every plan — only
            clients and case files are limited.
          </template>
          <template v-else>
            Purchases stay unlimited on every plan — only clients and case files are limited.
          </template>
        </p>

        <button
          v-for="p in plans"
          :key="p.key"
          type="button"
          class="cc-plan"
          :class="{ 'cc-plan--selected': plan === p.key }"
          @click="plan = p.key"
        >
          <div class="cc-plan__head">
            <div>
              <span class="cc-text-body-strong" style="font-size: 16px">{{ p.name }}</span>
              <AppBadge v-if="p.tag" :label="p.tag" />
            </div>
            <span class="cc-text-mono" style="font-size: 19px; font-weight: 700">{{ p.price }}</span>
          </div>
          <div class="cc-text-body" style="font-size: 12.5px">{{ p.detail }}</div>
        </button>

        <AppCard>
          <div class="cc-text-body-strong" style="font-size: 13.5px; margin-bottom: 9px">What you get</div>
          <div class="cc-feature"><AppIcon name="check_circle" :size="18" color="var(--cc-color-success)" />Case files with notes and attachments</div>
          <div class="cc-feature"><AppIcon name="check_circle" :size="18" color="var(--cc-color-success)" />Chat and video with your clients</div>
          <div class="cc-feature"><AppIcon name="check_circle" :size="18" color="var(--cc-color-success)" />Recommend products and order on their behalf</div>
        </AppCard>
      </div>
      <div class="cc-screen__footer">
        <AppButton :loading="submitting" style="margin-bottom: 9px" @click="onContinue">
          {{ selectedPlan.priceMinor > 0 ? `Pay ${selectedPlan.price} · ${selectedPlan.name}` : `Activate ${selectedPlan.name}` }}
        </AppButton>
        <p class="cc-text-caption" style="text-align: center">Downgrades keep your data — limits apply again.</p>
      </div>
    </ion-content>

    <AppSheet v-model="paySheetOpen" :title="`Pay ${selectedPlan.price}`">
      <p class="cc-text-caption" style="margin: 0 0 14px">
        {{ selectedPlan.name }} · billed once. Your plan starts as soon as the payment clears.
      </p>

      <div class="cc-pay">
        <button
          type="button"
          class="cc-pay__option"
          :class="{ 'cc-pay__option--selected': method === 'wallet' }"
          @click="method = 'wallet'"
        >
          <AppIcon name="savings" :size="22" :color="method === 'wallet' ? 'var(--cc-color-primary)' : 'var(--cc-ink-600)'" />
          <div class="cc-pay__body">
            <div class="cc-text-body-strong" style="font-size: 14.5px">CruxCare wallet</div>
            <div class="cc-text-caption">
              <template v-if="wallet">
                Balance <MoneyAmount :value="wallet.available" :currency="wallet.currency" />
              </template>
              <template v-else>Checking your balance…</template>
            </div>
          </div>
          <AppIcon v-if="method === 'wallet'" name="check_circle" :size="20" color="var(--cc-color-primary)" />
        </button>

        <button
          type="button"
          class="cc-pay__option"
          :class="{ 'cc-pay__option--selected': method === 'card' }"
          @click="method = 'card'"
        >
          <AppIcon name="credit_card" :size="22" :color="method === 'card' ? 'var(--cc-color-primary)' : 'var(--cc-ink-600)'" />
          <div class="cc-pay__body">
            <div class="cc-text-body-strong" style="font-size: 14.5px">Card</div>
            <div class="cc-text-caption">Debit or credit card, entered in our provider's secure sheet</div>
          </div>
          <AppIcon v-if="method === 'card'" name="check_circle" :size="20" color="var(--cc-color-primary)" />
        </button>

        <button
          type="button"
          class="cc-pay__option"
          :class="{ 'cc-pay__option--selected': method === 'bank-transfer' }"
          @click="method = 'bank-transfer'"
        >
          <AppIcon name="account_balance" :size="22" :color="method === 'bank-transfer' ? 'var(--cc-color-primary)' : 'var(--cc-ink-600)'" />
          <div class="cc-pay__body">
            <div class="cc-text-body-strong" style="font-size: 14.5px">Bank transfer</div>
            <div class="cc-text-caption">Transfer to the account our provider shows you</div>
          </div>
          <AppIcon v-if="method === 'bank-transfer'" name="check_circle" :size="20" color="var(--cc-color-primary)" />
        </button>
      </div>

      <div v-if="walletShortfall" class="cc-pay__warning">
        <AppIcon name="account_balance_wallet" :size="20" color="var(--cc-color-warning-text)" />
        <p>
          Your wallet is short for this plan.
          <button type="button" class="cc-pay__warning-link" @click="goTopUp">Fund your wallet</button>
          , or pay by card or bank transfer instead.
        </p>
      </div>

      <AppButton :loading="submitting" :disabled="method === 'wallet' && walletShortfall" @click="onPay">
        Pay {{ selectedPlan.price }}
      </AppButton>
    </AppSheet>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppBadge, AppButton, AppCard, AppIcon, AppSheet, MoneyAmount } from '@/components/ui';
import { PaymentUnavailableError, resolvePaymentProvider } from '@/services/payment';
import { paymentsApi } from '@/api/payments.api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { useWallet } from '@/composables/useWallet';
import { ApiError } from '@/types/api';
import type { TherapistPlanTier } from '@/types/user';
import type { PaymentChannel } from '@/types/payments';

const router = useRouter();
const auth = useAuthStore();
const toast = useToast();

/**
 * Serves two lanes. New therapists arrive mid-onboarding (step 2 of 2) and
 * continue to the completion screen. Existing therapists — including accounts
 * that held the role before plans existed, which the API returns as
 * `{ plan: null, status: 'inactive' }` — arrive from their dashboard or
 * profile and drop straight back into the practice once subscribed.
 */
const onboarding = !auth.roles.includes('therapist') || !auth.user?.therapistProfile;
const backHref = onboarding ? '/profile' : '/therapist/profile';

/** `priceMinor` mirrors subscription_plans.price; the server re-derives the
 *  charge from its own row, so this only drives what the UI offers. */
const plans: { key: TherapistPlanTier; name: string; price: string; priceMinor: number; detail: string; tag?: string }[] = [
  { key: 'free-trial', name: 'Free trial', price: '$0', priceMinor: 0, detail: '1 client · 1 case file · unlimited purchases' },
  { key: 'monthly', name: 'Monthly', price: '$15/mo', priceMinor: 1500, detail: '25 clients · unlimited case files · Point Facility hosting', tag: 'MOST CHOSEN' },
  { key: 'yearly', name: 'Yearly', price: '$200/yr', priceMinor: 20000, detail: 'Everything monthly · save $40 · priority assignment' },
];
const currentPlan = computed(() => auth.user?.therapistProfile?.plan ?? null);
const currentPlanLabel = computed(
  () => (auth.therapistPlanActive ? plans.find((p) => p.key === currentPlan.value)?.name : null) ?? null,
);

const plan = ref<TherapistPlanTier>(currentPlan.value ?? 'monthly');
const selectedPlan = computed(() => plans.find((p) => p.key === plan.value)!);
const submitting = ref(false);
const paySheetOpen = ref(false);
/** Wallet settles server-side; the other two open the gateway on that rail. */
const method = ref<'wallet' | PaymentChannel>('wallet');

const { data: wallet } = useWallet();
const walletShortfall = computed(
  () => !!wallet.value && wallet.value.available * 100 < selectedPlan.value.priceMinor,
);

/** Leaves the sheet open behind the push so returning lands back on payment. */
function goTopUp() {
  paySheetOpen.value = false;
  void router.push({ name: 'wallet-top-up' });
}

/** Free plans skip payment entirely; priced plans must settle first. */
function onContinue() {
  if (selectedPlan.value.priceMinor === 0) {
    void activate('wallet');
    return;
  }

  method.value = walletShortfall.value ? 'card' : 'wallet';
  paySheetOpen.value = true;
}

async function onPay() {
  if (method.value === 'wallet') {
    await activate('wallet');
    return;
  }

  await payByGateway(method.value);
}

/**
 * The API prices the plan and mints the reference; the provider's own sheet
 * collects the card, so no card detail passes through this app. Activation
 * then quotes that same reference back, and the server — not this screen —
 * decides whether the payment settled.
 */
async function payByGateway(channel: PaymentChannel) {
  submitting.value = true;
  try {
    const intent = await paymentsApi.createIntent({
      purpose: 'therapist-plan',
      subject: plan.value,
      expectedAmount: selectedPlan.value.priceMinor / 100,
      expectedCurrency: 'USD',
      channel,
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
      channel,
    });

    if (result.outcome === 'cancelled') {
      await toast.show('No payment was taken. Your plan is unchanged.', 'info', {
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

    // `authorized` and `pending` both hand off to the server: what the device
    // saw is a hint, and activation still returns 202 until Monnify confirms.
    await activate(intent.reference);
  } catch (e) {
    if (e instanceof PaymentUnavailableError) {
      await toast.show(e.message, 'danger', { title: 'Payment unavailable' });
      return;
    }

    const message =
      e instanceof ApiError ? e.message : 'We could not start that payment. Please try again.';
    await toast.show(message, 'danger', { title: 'Payment failed', dismissLabel: 'Try again' });
  } finally {
    submitting.value = false;
  }
}

async function activate(paymentToken: string) {
  submitting.value = true;
  try {
    const result = await auth.activateTherapist(plan.value, paymentToken);
    paySheetOpen.value = false;

    // The plan is not live until the provider confirms, so nothing here may
    // claim otherwise — the account still has no therapist plan.
    if (result.status === 'pending_payment') {
      await toast.show(result.payment.message, 'info', { title: 'Payment pending' });
      return;
    }

    if (onboarding) {
      router.replace({ name: 'therapist-onboarding-complete' });
      return;
    }

    router.replace({ name: 'therapist-today' });
    await toast.show(`Your ${selectedPlan.value.name} plan is active. You can take clients now.`, 'success', {
      title: 'Plan activated',
    });
  } catch (e) {
    const message = e instanceof ApiError ? e.message : 'We could not activate that plan. Please try again.';
    await toast.show(message, 'danger', {
      title: e instanceof ApiError && e.code === 'insufficient_funds' ? 'Wallet balance too low' : 'Activation failed',
      dismissLabel: 'Try again',
    });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.cc-plain-header {
  box-shadow: none;
}
.cc-plain-header__bar {
  --background: var(--cc-surface-0);
  --border-width: 0;
}
.cc-progress-track {
  height: 5px;
  border-radius: 999px;
  background: var(--cc-color-mist);
  margin: 0 16px 14px;
}
.cc-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--cc-color-primary);
}
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-plan {
  background: var(--cc-surface-0);
  border: 1px solid var(--cc-line);
  border-radius: 16px;
  padding: 14px;
  text-align: left;
  cursor: pointer;
}
.cc-plan--selected {
  border: 1.5px solid var(--cc-color-primary);
  box-shadow: 0 4px 14px rgba(14, 124, 107, 0.1);
}
.cc-plan__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}
.cc-pay {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 14px;
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
.cc-pay__warning {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
  padding: 12px 14px;
  border-radius: var(--cc-radius-md);
  background: var(--cc-color-warning-tint);
}
.cc-pay__warning p {
  margin: 0;
  color: var(--cc-color-warning-text);
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 17px;
}
.cc-pay__warning-link {
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}
.cc-feature {
  display: flex;
  gap: 8px;
  align-items: center;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  color: var(--cc-ink-600);
  margin-bottom: 7px;
}
.cc-screen__footer {
  padding: 11px 16px calc(25px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
</style>
