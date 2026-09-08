<template>
  <ion-page>
    <AppHeader title="Care plan" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <LoadingState v-if="isPending" label="Loading plans…" />

      <ErrorState
        v-else-if="isError"
        title="We could not load the plans"
        message="Nothing has been charged. Check your connection and try again."
      >
        <template #actions>
          <AppButton variant="secondary" @click="refetch()">Try again</AppButton>
        </template>
      </ErrorState>

      <EmptyState
        v-else-if="!options.length"
        icon="event_repeat"
        title="No plans offered yet"
        message="Your therapist sets the cadence for your treatment. You will be able to pay for it here once they have."
      />

      <div v-else class="cc-screen__pad cc-plan">
        <h2 class="cc-plan__title">Choose your visit cadence</h2>
        <p class="cc-plan__lede">
          Every plan includes chat with your therapist, your case file, and video or in-person
          visits.
        </p>

        <!-- The therapist's own words on what this course is for. Without it a
             cadence is a price with no reason attached to it. -->
        <AppCard v-if="planSummary" class="cc-plan__summary">
          <span class="cc-text-caption">YOUR THERAPIST RECOMMENDS</span>
          <p class="cc-text-body">{{ planSummary }}</p>
        </AppCard>

        <fieldset class="cc-plan__options">
          <legend class="cc-visually-hidden">Visit cadence</legend>
          <label
            v-for="option in options"
            :key="option.id"
            class="cc-plan__option"
            :class="{ 'cc-plan__option--selected': option.id === selectedId }"
          >
            <input v-model="selectedId" type="radio" name="care-plan" :value="option.id" />
            <span class="cc-plan__radio" aria-hidden="true" />
            <span class="cc-plan__body">
              <span class="cc-plan__head">
                <span class="cc-plan__name">{{ option.title }}</span>
                <span class="cc-plan__price">{{ planPrice(option) }}</span>
              </span>
              <span class="cc-plan__meta">{{ planSubtitle(option) }}</span>
              <AppBadge
                v-if="option.recommended"
                tone="success"
                label="Most chosen"
                class="cc-plan__pill"
              />
            </span>
          </label>
        </fieldset>

        <!-- Drawn as a dashed row rather than a fifth priced option: it is a
             conversation to have, not a price to pick. -->
        <button type="button" class="cc-plan__custom" @click="onCustom">
          <AppIcon name="tune" :size="22" color="var(--cc-ink-600)" />
          <span class="cc-plan__custom-body">
            <span class="cc-text-body-strong">Custom plan</span>
            <span class="cc-text-caption">Agree cadence and length with your therapist</span>
          </span>
          <AppIcon name="chevron_right" :size="20" color="var(--cc-ink-400)" />
        </button>

        <div class="cc-plan__notice">
          <AppIcon name="info" :size="20" color="var(--cc-color-warning-text)" />
          <p>Unused visits roll over for 30 days. Cancel any time before the next cycle.</p>
        </div>
      </div>
    </ion-content>

    <div v-if="selected" class="cc-plan__footer">
      <div class="cc-plan__footer-row">
        <span class="cc-text-caption">{{ selected.title }} · {{ selected.durationLabel }}</span>
        <span class="cc-text-body-strong">{{ planPrice(selected) }} today</span>
      </div>
      <AppButton :loading="paying" @click="onSubscribe">Subscribe to this plan</AppButton>
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { AppBadge, AppButton, AppCard, AppHeader, AppIcon } from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/state';
import { carePlansApi } from '@/api/care-plans.api';
import { caseFilesApi } from '@/api/case-files.api';
import { paymentsApi } from '@/api/payments.api';
import { PaymentUnavailableError, resolvePaymentProvider } from '@/services/payment';
import { planPrice, planSubtitle } from '@/features/care/carePlans';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();
const caseId = route.params.id as string;

const {
  data: plans,
  isPending,
  isError,
  refetch,
} = useQuery({
  queryKey: ['care-plans', caseId],
  queryFn: () => carePlansApi.list(caseId),
});

// Fetched alongside so the therapist's reasoning sits on the screen where the
// money is asked for, rather than one back-tap away on the care hub.
const { data: caseFile } = useQuery({
  queryKey: ['case-files', caseId],
  queryFn: () => caseFilesApi.get(caseId),
});

const options = computed(() => plans.value ?? []);
const planSummary = computed(() => caseFile.value?.treatmentPlan?.summary?.trim() || null);

const selectedId = ref<string | null>(null);
const paying = ref(false);

/** Seeded from the server's recommendation, never from the cheapest or the
 *  first: the default here is a nudge, so it has to be the therapist's. */
watch(
  options,
  (list) => {
    if (selectedId.value || !list.length) return;
    selectedId.value = (list.find((o) => o.recommended) ?? list[0]).id;
  },
  { immediate: true },
);

const selected = computed(() => options.value.find((o) => o.id === selectedId.value) ?? null);

function onCustom() {
  // A custom plan is agreed in conversation, so this goes to the therapist
  // rather than to a form that would pretend the app can price it.
  router.push({ name: 'care-hub', query: { ask: 'custom-plan', case: caseId } });
}

async function onSubscribe() {
  const option = selected.value;
  if (!option || paying.value) return;

  paying.value = true;
  try {
    const intent = await paymentsApi.createIntent({
      purpose: 'care-plan',
      subject: option.id,
      // The figure on screen, so the server refuses a stale price rather than
      // charging one the client never saw.
      expectedAmount: option.amountMinor / 100,
      expectedCurrency: option.currency,
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
      await toast.show('No payment was taken. Your plan is unchanged.', 'info', {
        title: 'Payment cancelled',
      });
      return;
    }

    if (result.outcome === 'failed') {
      await toast.show(result.message ?? 'That payment did not go through.', 'danger', {
        title: 'Payment failed',
        dismissLabel: 'Try again',
      });
      return;
    }

    // What the device saw is a hint. The server verifies the reference with the
    // gateway, so the subscription is its answer and not the SDK's.
    await carePlansApi.subscribe({
      caseId,
      planId: option.id,
      paymentToken: intent.reference,
      expectedAmountMinor: option.amountMinor,
      expectedCurrency: option.currency,
    });

    await queryClient.invalidateQueries({ queryKey: ['case-files'] });
    await queryClient.invalidateQueries({ queryKey: ['care-plans', caseId] });
    await toast.show('Your therapist can now start your treatment.', 'success', {
      title: 'Plan active',
    });
    await router.replace({ name: 'care-hub' });
  } catch (error) {
    if (error instanceof PaymentUnavailableError) {
      await toast.show(error.message, 'danger', { title: 'Payment unavailable' });
      return;
    }
    const message =
      error instanceof ApiError
        ? error.message
        : 'We could not start that payment. Please try again.';
    await toast.show(message, 'danger', { title: 'Payment failed', dismissLabel: 'Try again' });
  } finally {
    paying.value = false;
  }
}
</script>

<style scoped>
.cc-plan__title {
  font-size: 24px;
  font-weight: 700;
  line-height: 1.2;
  margin: 4px 0 6px;
}

.cc-plan__lede {
  margin: 0 0 18px;
  color: var(--cc-ink-400);
  font-size: 14.5px;
  line-height: 1.5;
}

.cc-plan__summary {
  margin-bottom: 16px;
}

.cc-plan__summary p {
  margin: 4px 0 0;
}

.cc-plan__options {
  border: 0;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cc-plan__option {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--cc-line);
  border-radius: 14px;
  background: var(--cc-surface-0);
  cursor: pointer;
}

.cc-plan__option--selected {
  border-color: var(--cc-color-primary);
  box-shadow: inset 0 0 0 1px var(--cc-color-primary);
}

.cc-plan__option input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.cc-plan__radio {
  flex: none;
  width: 22px;
  height: 22px;
  margin-top: 2px;
  border-radius: 50%;
  border: 2px solid var(--cc-ink-300);
  display: grid;
  place-items: center;
}

.cc-plan__option--selected .cc-plan__radio {
  border-color: var(--cc-color-primary);
}

.cc-plan__option--selected .cc-plan__radio::after {
  content: '';
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--cc-color-primary);
}

/* Keyboard focus has to land on the drawn ring, since the real input is hidden. */
.cc-plan__option input:focus-visible + .cc-plan__radio {
  outline: 2px solid var(--cc-color-primary);
  outline-offset: 2px;
}

.cc-plan__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.cc-plan__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.cc-plan__name {
  font-size: 16.5px;
  font-weight: 600;
}

.cc-plan__price {
  font-size: 17px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.cc-plan__meta {
  font-size: 13.5px;
  color: var(--cc-ink-400);
}

.cc-plan__pill {
  align-self: flex-start;
  margin-top: 6px;
}

.cc-plan__custom {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-top: 10px;
  padding: 16px;
  border: 1px dashed var(--cc-ink-300);
  border-radius: 14px;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.cc-plan__custom-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.cc-plan__notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 16px;
  padding: 14px;
  border-radius: 12px;
  background: var(--cc-color-warning-tint);
}

.cc-plan__notice p {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--cc-color-warning-text);
}

.cc-plan__footer {
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-line);
  background: var(--cc-surface-0);
}

.cc-plan__footer-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.cc-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
