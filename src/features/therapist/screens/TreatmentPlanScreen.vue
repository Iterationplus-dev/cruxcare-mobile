<template>
  <ion-page>
    <AppHeader title="Treatment plan" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <LoadingState v-if="isPending" label="Loading case…" />

      <ErrorState
        v-else-if="!caseFile"
        title="We could not load this case"
        message="Nothing has been changed. Check your connection and try again."
      >
        <template #actions>
          <AppButton variant="secondary" @click="refetch()">Try again</AppButton>
        </template>
      </ErrorState>

      <div v-else class="cc-screen__pad cc-tp">
        <!-- A plan the client has paid for is an agreement. It is changed by
             proposing a new one, never edited underneath them, so the form is
             replaced by a statement of what stands. -->
        <AppCard v-if="!editable" class="cc-tp__locked">
          <AppIcon name="lock" :size="20" color="var(--cc-ink-400)" />
          <div>
            <p class="cc-text-body-strong">This plan has been agreed</p>
            <p class="cc-text-caption">
              {{ agreedDetail }}
            </p>
          </div>
        </AppCard>

        <template v-else>
          <p class="cc-tp__lede">
            The client sees this before they pay, so write the cadence you would defend and say
            what the course is for.
          </p>

          <AppSectionLabel label="Cadence" />
          <AppSelect
            v-model="cadence"
            label="How often you will see them"
            :options="cadenceOptions"
            placeholder="Choose a cadence"
            :error="errors.cadence"
          />

          <!-- A custom cadence has no preset behind it, so the therapist prices
               it here. The server stores it as a plan scoped to this case, and
               it then reaches the client through the ordinary catalogue. -->
          <template v-if="cadence === 'custom'">
            <AppSectionLabel label="What you are charging for it" />
            <div class="cc-tp__dates">
              <AppInput
                v-model="visits"
                label="Visits"
                type="number"
                inputmode="numeric"
                placeholder="e.g. 10"
                :error="errors.visits"
              />
              <AppInput
                v-model="amount"
                label="Total price"
                type="number"
                inputmode="decimal"
                placeholder="e.g. 90.00"
                :error="errors.amount"
              />
            </div>
            <p class="cc-tp__hint">{{ perVisitHint }}</p>
          </template>

          <AppSectionLabel label="Treatment window" />
          <div class="cc-tp__dates">
            <AppInput
              v-model="startDate"
              label="Starts"
              type="date"
              :min="today"
              :error="errors.startDate"
            />
            <AppInput
              v-model="endDate"
              label="Ends"
              type="date"
              :min="startDate || today"
              :error="errors.endDate"
            />
          </div>
          <p class="cc-tp__hint">{{ windowHint }}</p>

          <AppSectionLabel label="What this is for" />
          <textarea
            v-model="summary"
            class="cc-textarea"
            rows="4"
            maxlength="600"
            placeholder="e.g. Twelve weeks of mobility work to restore lumbar flexion, reviewed at six weeks."
          />
          <p class="cc-tp__hint" :class="{ 'cc-tp__hint--error': !!errors.summary }">
            {{ errors.summary || `${summary.trim().length}/600 · the client reads this verbatim.` }}
          </p>

          <AppButton :loading="saving" :disabled="!changed" @click="onPropose">
            {{ caseFile.treatmentPlan?.cadence ? 'Update the plan' : 'Propose this plan' }}
          </AppButton>
          <p class="cc-tp__foot">
            Proposing replaces any plan they have not paid for yet. Nothing is charged here — the
            client chooses and pays on their own care plan screen.
          </p>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { AppButton, AppCard, AppHeader, AppIcon, AppInput, AppSectionLabel, AppSelect } from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/state';
import { casesApi } from '@/api/cases.api';
import { useCaseFile } from '@/composables/useCaseFiles';
import { canEditTreatmentPlan } from '@/features/therapist/caseStage';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();
const caseId = route.params.id as string;

const { data: caseFile, isPending, refetch } = useCaseFile(caseId);

const cadenceOptions = [
  { value: 'weekly', label: '1 visit a week' },
  { value: 'twice-weekly', label: '2 visits a week' },
  { value: 'thrice-weekly', label: '3 visits a week' },
  { value: 'custom', label: 'Custom — agreed with the client' },
];

const today = new Date().toISOString().slice(0, 10);

const cadence = ref('');
const startDate = ref('');
const endDate = ref('');
const summary = ref('');
const visits = ref('');
const amount = ref('');
const saving = ref(false);
const errors = reactive({
  cadence: '',
  startDate: '',
  endDate: '',
  summary: '',
  visits: '',
  amount: '',
});

/**
 * What the client will see on the card, worked out here only so the therapist
 * can sanity-check their own arithmetic before sending it. Nothing computed
 * here is sent or charged: the server prices the plan and decides whether a
 * per-visit figure divides evenly enough to show at all.
 */
const perVisitHint = computed(() => {
  const count = Number(visits.value);
  const total = Number(amount.value);
  if (!Number.isFinite(count) || !Number.isFinite(total) || count <= 0 || total <= 0) {
    return 'The client sees the total. A per-visit figure is shown only when it divides evenly.';
  }
  // Compared in minor units: 90/7 in floating point is exactly the arithmetic
  // that reports "even" for a figure that is not.
  const minor = Math.round(total * 100);
  if (minor % count !== 0) {
    return 'This does not divide evenly, so the card will show the total only.';
  }
  return `Works out at ${(minor / count / 100).toFixed(2)} a visit.`;
});

const editable = computed(() => canEditTreatmentPlan(caseFile.value));

const agreedDetail = computed(() => {
  const plan = caseFile.value?.treatmentPlan;
  if (!plan?.cadence) return 'Treatment is under way on this case.';
  const label = cadenceOptions.find((o) => o.value === plan.cadence)?.label ?? plan.cadence;
  return `${label}, ${formatDay(plan.startDate)} to ${formatDay(plan.endDate)}. Propose a new plan by closing this course and opening the next.`;
});

/** Re-seeded when the case loads or changes underneath, so the form shows what
 *  is stored rather than a stale edit from a previous visit to the screen. */
watch(
  () => caseFile.value?.treatmentPlan,
  (plan) => {
    cadence.value = plan?.cadence ?? '';
    startDate.value = plan?.startDate?.slice(0, 10) ?? '';
    endDate.value = plan?.endDate?.slice(0, 10) ?? '';
    summary.value = plan?.summary ?? '';
    // Left blank on a preset: they are the server's figures, not the
    // therapist's, and prefilling them would invite editing what is fixed.
    visits.value = '';
    amount.value = '';
  },
  { immediate: true },
);

const changed = computed(() => {
  const plan = caseFile.value?.treatmentPlan;
  return (
    cadence.value !== (plan?.cadence ?? '') ||
    startDate.value !== (plan?.startDate?.slice(0, 10) ?? '') ||
    endDate.value !== (plan?.endDate?.slice(0, 10) ?? '') ||
    summary.value.trim() !== (plan?.summary ?? '').trim()
  );
});

const windowHint = computed(() => {
  const weeks = weeksBetween(startDate.value, endDate.value);
  if (weeks === null) return 'The window is what the client is buying, so it sets the plan length.';
  return `${weeks} week${weeks === 1 ? '' : 's'}. The plans they are offered are built from this.`;
});

function validate(): boolean {
  errors.cadence = cadence.value ? '' : 'Choose how often you will see them.';
  errors.startDate = startDate.value ? '' : 'Set a start date.';
  errors.endDate = endDate.value ? '' : 'Set an end date.';
  // Checked here as well as server-side so the therapist is told before the
  // round trip, not after it.
  if (!errors.endDate && startDate.value && endDate.value && endDate.value < startDate.value) {
    errors.endDate = 'The window cannot end before it starts.';
  }
  errors.summary = summary.value.trim() ? '' : 'Say what this course of treatment is for.';

  errors.visits = '';
  errors.amount = '';
  if (cadence.value === 'custom') {
    const count = Number(visits.value);
    const total = Number(amount.value);
    if (!Number.isInteger(count) || count <= 0) {
      errors.visits = 'How many visits does this cover?';
    }
    if (!Number.isFinite(total) || total <= 0) {
      errors.amount = 'Set a price for the course.';
    }
  }

  return (
    !errors.cadence &&
    !errors.startDate &&
    !errors.endDate &&
    !errors.summary &&
    !errors.visits &&
    !errors.amount
  );
}

async function onPropose() {
  if (saving.value || !validate()) return;

  saving.value = true;
  try {
    await casesApi.proposePlan(caseId, {
      planId: caseFile.value?.treatmentPlan?.planId ?? null,
      cadence: cadence.value,
      startDate: startDate.value,
      endDate: endDate.value,
      summary: summary.value.trim(),
      // Only ever sent for a custom cadence; a preset is priced server-side and
      // a price from here would be a client-side one.
      ...(cadence.value === 'custom'
        ? { visits: Number(visits.value), amount: Number(amount.value) }
        : {}),
    });
    await queryClient.invalidateQueries({ queryKey: ['case-files'] });
    await queryClient.invalidateQueries({ queryKey: ['care-plans', caseId] });
    await toast.show('They can choose and pay for it now.', 'success', { title: 'Plan sent' });
    await router.back();
  } catch (error) {
    // The client may have paid while this screen sat open, which turns the
    // proposal into an agreement — refetching is what makes that visible.
    if (error instanceof ApiError && error.code === 'plan_already_agreed') {
      await queryClient.invalidateQueries({ queryKey: ['case-files'] });
      await toast.show(error.message, 'warning', { title: 'Already agreed' });
      return;
    }
    const message =
      error instanceof ApiError ? error.message : 'We could not send that plan. Please try again.';
    await toast.show(message, 'danger', { title: 'Not sent' });
  } finally {
    saving.value = false;
  }
}

function weeksBetween(from: string, to: string): number | null {
  if (!from || !to) return null;
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  return Math.max(1, Math.round((b - a) / (7 * 24 * 60 * 60 * 1000)));
}

function formatDay(iso: string | null | undefined): string {
  if (!iso) return 'an unset date';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
</script>

<style scoped>
.cc-tp__lede {
  margin: 4px 0 16px;
  color: var(--cc-ink-400);
  font-size: 14px;
  line-height: 1.5;
}

.cc-tp__dates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.cc-tp__hint {
  margin: 6px 0 16px;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--cc-ink-400);
}

.cc-tp__hint--error {
  color: var(--cc-error-surface-text);
}

.cc-tp__foot {
  margin: 12px 0 0;
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--cc-ink-400);
}

.cc-tp__locked {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.cc-tp__locked p {
  margin: 0;
}

.cc-tp__locked p + p {
  margin-top: 3px;
}
</style>
