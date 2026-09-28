<template>
  <ion-page>
    <AppHeader title="Care plan" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <!-- Above the plan catalogue and outside its loading and error states:
           what the client owes, and the products waiting on their answer, do
           not depend on the cadence list and must not disappear with it. -->
      <div class="cc-screen__pad cc-plan__billing">
        <CaseBillCard :case-id="caseId" />
        <RecommendedProducts :case-id="caseId" />
      </div>

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

      <!-- Chosen already, so the catalogue is not shown again.
           Choosing the cadence is a decision the client has made; re-offering
           the list underneath their own bill invites them to make it twice and
           reads as though it had not registered. What replaces it says what
           they picked and where the money goes out, which is the only thing
           left to do on this screen. -->
      <div v-else-if="hasChosenPlan" class="cc-screen__pad cc-plan">
        <div class="cc-plan__chosen">
          <AppIcon name="check_circle" :size="22" color="var(--cc-color-primary)" />
          <div class="cc-plan__chosen-body">
            <span class="cc-text-body-strong">{{ chosenTitle }}</span>
            <span class="cc-text-caption">{{ chosenDetail }}</span>
          </div>
        </div>
        <div class="cc-plan__notice">
          <AppIcon name="info" :size="20" color="var(--cc-color-warning-text)" />
          <p>{{ chosenNotice }}</p>
        </div>
      </div>

      <div v-else class="cc-screen__pad cc-plan">
        <h2 class="cc-plan__title">Choose your visit cadence</h2>
        <p class="cc-plan__lede">
          Every plan includes chat with your therapist, your case file, and video or in-person
          visits.
        </p>

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
                v-if="option.bespoke"
                tone="default"
                label="Made for you"
                class="cc-plan__pill"
              />
              <AppBadge
                v-else-if="option.recommended"
                tone="success"
                label="Most chosen"
                class="cc-plan__pill"
              />
            </span>
          </label>
        </fieldset>

        <!-- D2b draws this as a dashed row, and it stays one until there is a
             bespoke plan to show: a custom plan is a conversation to have right
             up to the moment the therapist has priced one, at which point it is
             a card above and asking again would make no sense. -->
        <button v-if="!hasBespoke" type="button" class="cc-plan__custom" @click="onCustom">
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

    <!-- Choosing is not paying. Picking the plan is what puts a price on the
         treatment, which is what makes the deposit and the instalments above
         possible — the money then leaves from the bill, where the client can
         see the whole case rather than one line of it. -->
    <div v-if="selected && !hasChosenPlan" class="cc-plan__footer">
      <div class="cc-plan__footer-row">
        <span class="cc-text-caption">{{ selected.title }} · {{ selected.durationLabel }}</span>
        <span class="cc-text-body-strong">{{ planPrice(selected) }}</span>
      </div>
      <AppButton :loading="choosing" @click="onChoose">Choose this plan</AppButton>
      <p class="cc-plan__footer-note">
        Nothing is charged yet — this only sets what your treatment costs.
      </p>
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { AppBadge, AppButton, AppHeader, AppIcon } from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/state';
import { carePlansApi } from '@/api/care-plans.api';
import { casesApi } from '@/api/cases.api';
import { useCaseBill } from '@/composables/useCaseFiles';
import { planPrice, planSubtitle } from '@/features/care/carePlans';
import CaseBillCard from '@/features/care/components/CaseBillCard.vue';
import RecommendedProducts from '@/features/care/components/RecommendedProducts.vue';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();
/**
 * The *case* id, not the case file's. `/care/plans`, the bill and the
 * recommendation routes are all keyed by it, and passing a case file id here
 * is answered with "That case could not be found" — which is exactly what this
 * screen did until the care hub was corrected to pass the right one.
 */
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

// The therapist's plan summary used to be fetched here, from
// `GET /case-files/{id}`. That route also returns the diagnosis and clinical
// notes still marked `draft`, so reading it put the clinical record on the
// patient's device to render one sentence written for them. Until the summary
// is available on a client-safe route, the bill above carries this screen.

const options = computed(() => plans.value ?? []);
const hasBespoke = computed(() => options.value.some((o) => o.bespoke));

const selectedId = ref<string | null>(null);
const choosing = ref(false);

/**
 * Whether a plan has been picked already.
 *
 * Read off the bill, because a priced treatment is exactly what choosing
 * produces. Which plan it is cannot be told from here — neither the bill nor
 * the catalogue names it — so the button says "change to this plan" rather
 * than marking a row as chosen.
 */
const { data: bill } = useCaseBill(() => caseId);
const hasChosenPlan = computed(() => (bill.value?.treatmentTotalMinor ?? 0) > 0);

/**
 * Whether any money has gone against treatment.
 *
 * A deposit was 70% of a particular price, so once one is paid the plan is
 * fixed — the server refuses a change with `treatment_part_paid`. The cadence
 * is therefore not merely chosen at this point but settled, and the copy says
 * so rather than implying it could still be swapped.
 */
const planPaidAgainst = computed(() => (bill.value?.treatmentPaidMinor ?? 0) > 0);

/** The chosen row, where the catalogue marks one. Older servers do not, and an
 *  unnamed plan is better than the wrong name. */
const chosenOption = computed(() => options.value.find((o) => o.chosen) ?? null);

const chosenTitle = computed(() =>
  chosenOption.value ? chosenOption.value.title : 'Your plan is set',
);

const chosenDetail = computed(() => {
  const option = chosenOption.value;
  if (option) return `${option.durationLabel} · ${planPrice(option)}`;
  return 'Your therapist set the cadence and you have agreed to it.';
});

const chosenNotice = computed(() =>
  planPaidAgainst.value
    ? 'This cadence is now fixed — you have paid against it. Your therapist can extend the treatment window if you need longer.'
    : 'Pay for it from the case total above, in full or as a deposit. Message your therapist if the cadence needs to change.',
);

/** Seeded from the therapist's own plan where there is one, then from the
 *  server's recommendation — never from the cheapest or the first. The default
 *  here is a nudge, so it has to be theirs rather than ours. */
watch(
  options,
  (list) => {
    if (selectedId.value || !list.length) return;
    const preferred = list.find((o) => o.bespoke) ?? list.find((o) => o.recommended) ?? list[0];
    selectedId.value = preferred.id;
  },
  { immediate: true },
);

const selected = computed(() => options.value.find((o) => o.id === selectedId.value) ?? null);

function onCustom() {
  // A custom plan is agreed in conversation, so this goes to the therapist
  // rather than to a form that would pretend the app can price it.
  router.push({ name: 'care-hub', query: { ask: 'custom-plan', case: caseId } });
}

/**
 * Records which plan the client is buying. Nobody is charged.
 *
 * The therapist's window is untouched: the plan says what is being bought,
 * the therapist says when it happens.
 */
async function onChoose() {
  const option = selected.value;
  if (!option || choosing.value) return;

  choosing.value = true;
  try {
    await casesApi.choosePlan(caseId, option.id);
    await queryClient.invalidateQueries({ queryKey: ['case-bill'] });
    await queryClient.invalidateQueries({ queryKey: ['care-plans', caseId] });
    await queryClient.invalidateQueries({ queryKey: ['case-files'] });
    await toast.show(
      `${option.title} is your plan. Pay for it from the case total above, in full or as a deposit.`,
      'success',
      { title: 'Plan chosen' },
    );
  } catch (error) {
    // Once a deposit is paid it was 70% of a particular price, so the plan is
    // fixed. Refetch so the screen stops offering a change it cannot make.
    if (error instanceof ApiError && error.code === 'treatment_part_paid') {
      await queryClient.invalidateQueries({ queryKey: ['case-bill'] });
      await toast.show(error.message, 'warning', { title: 'Already part paid' });
      return;
    }
    const message =
      error instanceof ApiError ? error.message : 'We could not set that plan. Please try again.';
    await toast.show(message, 'danger', { title: 'Not saved', dismissLabel: 'Try again' });
  } finally {
    choosing.value = false;
  }
}

</script>

<style scoped>
/* Scoped styles are per-component, so the screen shell has to be restated
   here the way every other screen restates it. Padding only, no flex gap:
   this screen spaces itself with margins. */
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 16px 16px 28px;
}

/* Its own padded block, so the panels keep the screen gutter while sitting
   outside the branch that owns the rest of the padding. */
.cc-plan__billing:empty {
  display: none;
}
.cc-plan__chosen {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px;
  border-radius: var(--cc-radius-lg);
  background: var(--cc-color-mist);
  margin-bottom: 14px;
}
.cc-plan__chosen-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.cc-plan__billing {
  padding-bottom: 0;
}
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

.cc-plan__footer-note {
  margin: 8px 0 0;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 16px;
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
