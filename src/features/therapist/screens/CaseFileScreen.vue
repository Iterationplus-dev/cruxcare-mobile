<template>
  <ion-page>
    <AppHeader :title="caseFile?.clientName ?? 'Case file'" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <LoadingState v-if="isPending" label="Loading case file…" />
      <!-- Without these the screen rendered nothing at all when the fetch
           failed: a blank page under a "Case file" header, with no way to tell
           a missing record from a broken request. The two are kept apart so
           neither explanation is given for the other's cause. -->
      <EmptyState
        v-else-if="notFound"
        icon="folder_off"
        title="This case file isn't available"
        message="It may not have been opened yet, or it belongs to another therapist. Try again from your clients list."
        primary-action="Back to clients"
        @primary="router.push({ name: 'therapist-clients' })"
      />

      <EmptyState
        v-else-if="!caseFile"
        icon="cloud_off"
        title="Couldn't load this case file"
        :message="loadErrorMessage"
        primary-action="Try again"
        @primary="refetch()"
      />
      <div v-else class="cc-screen__pad">
        <!-- A file opened by accepting a request is empty by design, so every
             row here states "not recorded yet" rather than rendering a blank. -->
        <AppCard>
          <div class="cc-row"><span class="cc-text-caption">Sessions</span><span class="cc-text-body-strong" style="font-size: 13.5px">{{ caseFile.sessionCount ?? 0 }}</span></div>
          <div class="cc-row"><span class="cc-text-caption">Last session</span><span class="cc-text-body-strong" style="font-size: 13.5px">{{ caseFile.lastSessionAt ? formatDate(caseFile.lastSessionAt) : 'None yet' }}</span></div>
          <div class="cc-row">
            <span class="cc-text-caption">Diagnosis</span>
            <span class="cc-text-body-strong" :class="{ 'cc-unset': !caseFile.diagnosis }" style="font-size: 13.5px">
              {{ caseFile.diagnosis || 'Not recorded yet' }}
            </span>
          </div>
          <div class="cc-row">
            <span class="cc-text-caption">Treatment window</span>
            <span class="cc-text-body-strong" :class="{ 'cc-unset': !treatmentWindow }" style="font-size: 13.5px">
              {{ treatmentWindow ?? 'Not set yet' }}
            </span>
          </div>
          <!-- No clear control: the server refuses null and blank, because a
               file never diagnosed and one wiped would otherwise read alike.
               No edit control on a settled case either — that write is a 404. -->
          <div v-if="canEdit" class="cc-diagnosis">
            <AppInput
              v-model="diagnosisDraft"
              label="Record or correct the diagnosis"
              placeholder="e.g. Lumbar strain with reduced flexion"
              :error="diagnosisError"
              helper="Corrections are kept with what they replaced."
            />
            <AppButton
              variant="secondary"
              :loading="savingDiagnosis"
              :disabled="!diagnosisChanged"
              @click="onSaveDiagnosis"
            >
              {{ caseFile.diagnosis ? 'Update diagnosis' : 'Record diagnosis' }}
            </AppButton>
          </div>
        </AppCard>

        <!-- Where this case has got to, and who it is waiting on. Derived from
             what is recorded rather than from a status column, so it cannot
             claim a stage the data does not support. -->
        <AppCard class="cc-stage" :class="'cc-stage--' + stage.waitingOn">
          <div class="cc-stage__head">
            <span class="cc-stage__label">{{ stage.label }}</span>
            <AppBadge v-if="stage.waitingOn === 'client'" tone="warning" label="With the client" />
          </div>
          <p class="cc-stage__detail">{{ stage.detail }}</p>

          <div v-if="stageActions.length" class="cc-stage__actions">
            <AppButton
              v-for="action in stageActions"
              :key="action.key"
              :variant="action.primary ? 'primary' : 'secondary'"
              :loading="busyAction === action.key"
              :full-width="false"
              @click="action.run"
            >
              {{ action.label }}
            </AppButton>
          </div>
        </AppCard>

        <!-- The course of treatment, once there is one. Kept apart from the
             stage card because it is a record, not a prompt. -->
        <AppCard v-if="plan?.cadence" style="padding: 0">
          <AppListRow
            title="Treatment plan"
            :subtitle="planSubtitleLine"
            icon="event_repeat"
            chevron
            clickable
            :divider="!!subscription"
            @click="router.push({ name: 'treatment-plan', params: { id } })"
          />
          <AppListRow
            v-if="subscription"
            title="Care plan"
            :subtitle="subscriptionLine"
            :subtitle-tone="subscriptionTone"
            icon="payments"
            :divider="false"
          />
        </AppCard>

        <!-- Consent, not a data panel: what it shows in each state is decided
             by healthProfileAccessView, so the screen cannot invent a fifth. -->
        <AppCard class="cc-hp">
          <div class="cc-hp__head">
            <AppIcon name="medical_information" :color="accessTone" :size="20" />
            <div class="cc-hp__headings">
              <span class="cc-text-body-strong" style="font-size: 14.5px">{{ access.title }}</span>
              <span class="cc-text-caption">{{ access.message }}</span>
            </div>
          </div>

          <template v-if="access.showsProfile">
            <LoadingState v-if="profilePending" label="Loading health profile…" />
            <dl v-else-if="profile" class="cc-hp__sections">
              <div v-for="section in profile.sections" :key="section.key" class="cc-hp__section">
                <dt class="cc-text-caption">{{ section.label }}</dt>
                <!-- A section with no value was left blank by the client. It is
                     not the same as one withheld, and must not read as one. -->
                <dd class="cc-text-body" :class="{ 'cc-unset': !section.value }">
                  {{ section.value || 'Not recorded' }}
                </dd>
              </div>
            </dl>
          </template>

          <template v-if="access.canRequest">
            <AppInput
              v-model="reasonDraft"
              label="Why you need it (optional)"
              placeholder="e.g. To check for conditions that affect which exercises are safe"
              helper="The client reads this when they decide. 240 characters."
            />
            <AppButton variant="secondary" :loading="asking" @click="onAskForAccess">
              {{ access.kind === 'revoked' ? 'Ask again' : 'Ask to read this profile' }}
            </AppButton>
          </template>
        </AppCard>

        <p class="cc-record__label">Client record · {{ (caseFile.clientName || 'CruxCare client').toUpperCase() }}</p>

        <!-- TD4's three tiles. Adherence is not among them: the backend has
             asked what it is a percentage of and nobody has answered, so a
             number here would be invented rather than measured. -->
        <AppCard class="cc-record__tiles">
          <div class="cc-record__tile">
            <span class="cc-record__tile-label">Sessions</span>
            <span class="cc-record__tile-value">{{ caseFile.sessionCount ?? 0 }}</span>
          </div>
          <div class="cc-record__tile">
            <span class="cc-record__tile-label">No-shows</span>
            <span class="cc-record__tile-value">{{ caseFile.noShowCount ?? 0 }}</span>
          </div>
          <div class="cc-record__tile">
            <span class="cc-record__tile-label">Notes</span>
            <span class="cc-record__tile-value">{{ caseFile.notes.length }}</span>
          </div>
        </AppCard>

        <!-- TD4 puts Messages on the client record beside the notes. Without it
             a therapist could see an unread count on the dashboard and had no
             route to the conversation it referred to. -->
        <AppCard style="padding: 0">
          <AppListRow
            title="Session notes"
            :subtitle="notesSubtitle"
            :subtitle-tone="hasUnwrittenNotes ? 'warning' : undefined"
            icon="description"
            :icon-color="hasUnwrittenNotes ? 'var(--cc-color-warning)' : 'var(--cc-color-primary)'"
          />
          <AppListRow
            v-if="medicationTotal"
            title="Recommended products"
            :subtitle="medicationTotal"
            icon="shopping_basket"
            :divider="true"
          />
          <AppListRow
            title="Messages"
            :subtitle="messagesSubtitle"
            icon="forum"
            chevron
            clickable
            :divider="false"
            @click="goMessages"
          />
        </AppCard>

        <!-- The recovery record. Only once treatment has started, because
             before that there is nothing to report on — and separate from
             Notes below on purpose: a note is the clinician writing to
             themselves and can sit in draft, while this is the account of how
             the client is actually responding, which an extension or a closing
             summary is argued from. -->
        <template v-if="treatmentStarted">
          <div class="cc-section-head">
            <span class="cc-text-body-strong" style="font-size: 16px">Progress</span>
            <button type="button" class="cc-recommendations__add" @click="openProgressSheet">
              <AppIcon name="add" :size="18" />
              Add report
            </button>
          </div>

          <p v-if="!progressReports.length" class="cc-progress__empty cc-text-caption">
            Nothing recorded yet. A report says how they are responding, what you administered and
            what you did.
          </p>

          <AppCard v-for="p in progressReports" :key="p.id" class="cc-progress">
            <div class="cc-progress__head">
              <AppBadge :label="trendLabel(p.trend)" :tone="trendTone(p.trend)" />
              <span class="cc-text-caption">{{ formatDay(p.recordedFor) }}</span>
            </div>
            <p class="cc-text-body" style="margin: 0">{{ p.condition }}</p>
            <div v-if="p.productsAdministered" class="cc-progress__line">
              <span class="cc-text-caption">Administered</span>
              <p>{{ p.productsAdministered }}</p>
            </div>
            <div v-if="p.techniques" class="cc-progress__line">
              <span class="cc-text-caption">Techniques</span>
              <p>{{ p.techniques }}</p>
            </div>
          </AppCard>

          <!-- Every time this window has been pushed out. Kept as history
               rather than an overwritten end date: "this course ran twice as
               long as planned" is clinically meaningful. -->
          <AppCard v-if="extensions.length" class="cc-extensions">
            <span class="cc-text-body-strong" style="font-size: 14px">Extensions</span>
            <div v-for="e in extensions" :key="e.id" class="cc-extensions__row">
              <div class="cc-extensions__head">
                <span class="cc-text-caption">
                  {{ formatDay(e.previousEndDate) }} → {{ formatDay(e.newEndDate) }}
                  <template v-if="e.addedVisits > 0">· +{{ e.addedVisits }} visits</template>
                </span>
                <AppBadge :label="extensionLabel(e)" :tone="extensionTone(e)" />
              </div>
              <p>{{ e.reason }}</p>
              <!-- An offer, not a fact. Saying so matters: the window has not
                   moved and the visits are not theirs to book yet. -->
              <template v-if="e.status === 'awaiting-payment'">
                <p class="cc-extensions__pending">
                  Waiting on
                  <MoneyAmount :value="e.amountMinor / 100" :currency="e.currency" />
                  from the client. Nothing changes until they pay.
                </p>
                <AppButton
                  variant="destructive-text"
                  :full-width="false"
                  :loading="withdrawingId === e.id"
                  @click="onWithdrawExtension(e)"
                >
                  Withdraw this offer
                </AppButton>
              </template>
            </div>
          </AppCard>
        </template>

        <div class="cc-section-head">
          <span class="cc-text-body-strong" style="font-size: 16px">Notes</span>
        </div>
        <AppCard v-for="n in caseFile.notes" :key="n.id" class="cc-note">
          <p class="cc-text-body" style="margin: 0 0 6px">{{ n.body }}</p>
          <div class="cc-text-caption">{{ formatDate(n.createdAt) }} <span v-if="n.draft">· draft — locks once the session is marked complete</span></div>
        </AppCard>
        <textarea v-model="draftNote" class="cc-textarea" rows="3" placeholder="Add a session note" />
        <AppButton variant="secondary" :loading="savingNote" @click="onAddNote">Save note</AppButton>

        <section class="cc-recommendations" aria-labelledby="recommendations-title">
          <div class="cc-recommendations__heading">
            <div>
              <h2 id="recommendations-title">Recommendations</h2>
              <p>Products suggested for this client’s care.</p>
            </div>
            <!-- Carries the case, so the shop knows it is being browsed on a
                 client's behalf. Without it the therapist lands in their own
                 basket and buys the client's treatment themselves. -->
            <button type="button" class="cc-recommendations__add" @click="goRecommend">
              <AppIcon name="add" :size="18" />
              Add
            </button>
          </div>

          <!-- What the client actually owes, rather than what has been
               suggested to them: a pending line costs nothing, so the summed
               recommendations and the bill are different numbers. -->
          <div v-if="bill" class="cc-reco-bill">
            <div>
              <span>Treatment</span>
              <MoneyAmount :value="bill.treatmentTotal" :currency="bill.currency" />
            </div>
            <div>
              <span>Products accepted</span>
              <MoneyAmount :value="bill.productsTotal" :currency="bill.currency" />
            </div>
            <div class="cc-reco-bill__due">
              <span>{{ bill.outstandingMinor > 0 ? 'Client still owes' : 'Paid up' }}</span>
              <MoneyAmount :value="bill.outstanding" :currency="bill.currency" />
            </div>
          </div>

          <div v-if="!caseFile.recommendations.length" class="cc-recommendations__empty">
            <AppIcon name="spa" :size="22" color="var(--cc-color-primary)" />
            <span>No products recommended yet.</span>
          </div>

          <AppCard v-for="r in caseFile.recommendations" :key="r.id" class="cc-reco">
            <div class="cc-reco__top">
              <!-- The actual product rather than a generic pill icon: the
                   therapist is picking between things that look different. -->
              <ProductImage
                :media="products.find((p) => p.id === r.productId)?.media ?? []"
                :name="recommendationName(r)"
                class="cc-reco__thumb"
              />
              <div class="cc-reco__product">
                <span class="cc-text-mono">CARE RECOMMENDATION</span>
                <h3>{{ recommendationName(r) }}</h3>
              </div>
              <AppBadge :label="statusLabel(r.status)" :tone="statusTone(r.status)" />
            </div>

            <!-- What this line adds to the client's bill. Captured figures, so
                 a later reprice cannot move a bill already agreed to. -->
            <div class="cc-reco__cost">
              <span
                >{{ r.quantity }} ×
                <MoneyAmount :value="r.unitPrice" :currency="r.currency" />
              </span>
              <MoneyAmount :value="r.total" :currency="r.currency" />
            </div>

            <div v-if="r.note" class="cc-reco__guidance">
              <AppIcon name="info" :size="18" color="var(--cc-color-primary)" />
              <div>
                <span>Suggested use</span>
                <p>{{ r.note }}</p>
              </div>
            </div>

            <div class="cc-reco__footer">
              <span>{{ statusDetail(r) }}</span>
              <div class="cc-reco__actions">
                <!-- `removable` is the server's own answer, so the control is
                     disabled rather than offered and then refused: a paid line
                     is a refund, not a delete. -->
                <AppButton
                  v-if="canEdit"
                  variant="destructive-text"
                  :full-width="false"
                  :disabled="r.removable === false"
                  :loading="removingLine === r.id"
                  @click="onRemoveRecommendation(r)"
                >
                  Remove
                </AppButton>
                <AppButton
                  variant="secondary"
                  :full-width="false"
                  @click="
                    router.push({
                      name: 'product-detail',
                      params: { id: r.productId },
                      // Marks where this was opened from, so the shop screen
                      // offers no basket: this line is already prescribed.
                      query: { from: 'case-recommendation' },
                    })
                  "
                >
                  View product
                </AppButton>
              </div>
            </div>
          </AppCard>
        </section>
      </div>
    </ion-content>

    <AppSheet v-model="progressOpen" title="Record progress">
      <p class="cc-text-caption" style="margin: 0 0 12px">
        How they are responding is required. Leave the other two empty where nothing applies —
        writing “none” to fill a box is how a record fills up with noise.
      </p>

      <label class="cc-progress__label" for="cc-progress-day">Session date</label>
      <!-- Capped at today: an entry dated next Tuesday makes the record say
           something untrue, the same way one dated before the first session
           would. The server refuses it as `recorded_for_in_future`. -->
      <input
        id="cc-progress-day"
        v-model="progressDay"
        type="date"
        class="cc-input-native"
        :max="todayIso()"
      />

      <label class="cc-progress__label" for="cc-progress-trend">How it is going</label>
      <div id="cc-progress-trend" class="cc-progress__trends">
        <button
          v-for="t in TRENDS"
          :key="t.value"
          type="button"
          class="cc-progress__trend"
          :class="{ 'cc-progress__trend--on': progressTrend === t.value }"
          @click="progressTrend = t.value"
        >
          {{ t.label }}
        </button>
      </div>

      <label class="cc-progress__label" for="cc-progress-condition">Recovery condition</label>
      <textarea
        id="cc-progress-condition"
        v-model="progressCondition"
        class="cc-textarea"
        rows="3"
        maxlength="1000"
        placeholder="e.g. Range of motion in the right shoulder is noticeably better; pain on rotation down from 7 to 4."
      />

      <label class="cc-progress__label" for="cc-progress-products">Products administered</label>
      <textarea
        id="cc-progress-products"
        v-model="progressProducts"
        class="cc-textarea"
        rows="2"
        maxlength="600"
        placeholder="e.g. Care Blood Activator, one sachet applied topically."
      />

      <label class="cc-progress__label" for="cc-progress-techniques">Techniques</label>
      <textarea
        id="cc-progress-techniques"
        v-model="progressTechniques"
        class="cc-textarea"
        rows="2"
        maxlength="600"
        placeholder="e.g. Deep tissue work on the trapezius, 20 minutes; assisted stretching."
      />

      <p v-if="progressError" class="cc-close__error">{{ progressError }}</p>
      <AppButton
        :loading="busyAction === 'progress'"
        style="margin-top: 12px; margin-bottom: 9px"
        @click="onSaveProgress"
      >
        Save report
      </AppButton>
      <AppButton variant="text" :disabled="busyAction === 'progress'" @click="progressOpen = false">
        Cancel
      </AppButton>
    </AppSheet>

    <AppSheet v-model="extendOpen" title="Extend this treatment">
      <!-- This used to say extra visits were "added to their bill", which
           described option (a). The backend chose (b): the client is asked to
           buy them as a plan, and nothing moves until they do. -->
      <p class="cc-text-caption" style="margin: 0 0 12px">
        The window is yours to set, so more time costs the client nothing. Extra visits are
        sessions they have not bought — those are offered as a top-up plan, and the window only
        moves once they have paid for it.
      </p>

      <label class="cc-progress__label" for="cc-extend-date">New end date</label>
      <input
        id="cc-extend-date"
        v-model="extendDate"
        type="date"
        class="cc-input-native"
        :min="plan?.endDate ?? undefined"
      />
      <p class="cc-text-caption" style="margin: 4px 0 0">
        Currently ends {{ formatDay(plan?.endDate ?? null) }}
      </p>

      <label class="cc-progress__label" for="cc-extend-visits">Extra visits</label>
      <input
        id="cc-extend-visits"
        v-model.number="extendVisits"
        type="number"
        min="0"
        max="60"
        class="cc-input-native"
      />
      <p class="cc-text-caption" style="margin: 4px 0 0">
        {{ extendVisitsNote }}
      </p>

      <label class="cc-progress__label" for="cc-extend-reason">Why it needs longer</label>
      <textarea
        id="cc-extend-reason"
        v-model="extendReason"
        class="cc-textarea"
        rows="3"
        maxlength="600"
        placeholder="e.g. Recovery is on track but slower than planned; four more weeks should finish it."
      />

      <p v-if="extendError" class="cc-close__error">{{ extendError }}</p>
      <AppButton
        :loading="busyAction === 'extend'"
        style="margin-top: 12px; margin-bottom: 9px"
        @click="onExtend"
      >
        {{ extendVisits > 0 ? 'Offer this extension' : 'Extend the treatment' }}
      </AppButton>
      <AppButton variant="text" :disabled="busyAction === 'extend'" @click="extendOpen = false">
        Cancel
      </AppButton>
    </AppSheet>

    <AppSheet v-model="closing" title="Close this case?">
      <p class="cc-text-body" style="margin: 0 0 12px">{{ closingConsequence }}</p>
      <textarea
        v-model="closingSummary"
        class="cc-textarea"
        rows="3"
        maxlength="600"
        placeholder="How did this course of treatment end?"
      />
      <p v-if="closingError" class="cc-close__error">{{ closingError }}</p>
      <AppButton :loading="busyAction === 'close'" style="margin-bottom: 9px" @click="onCloseCase">
        Close the case
      </AppButton>
      <AppButton variant="text" :disabled="busyAction === 'close'" @click="closing = false">
        Keep it open
      </AppButton>
    </AppSheet>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import {
  AppBadge,
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppInput,
  AppListRow,
  AppSheet,
  MoneyAmount,
} from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { caseFilesApi } from '@/api/case-files.api';
import { healthAccessApi } from '@/api/health-access.api';
import { useCaseBill, useCaseFile, useClientHealthProfile } from '@/composables/useCaseFiles';
import { findThreadWith, useChatThreads } from '@/composables/useChat';
import { canEditDiagnosis } from '@/features/therapist/caseFilePermissions';
import { canScheduleSessions, caseStage } from '@/features/therapist/caseStage';
import { subscriptionSummary } from '@/features/care/carePlans';
import { formatMinor, formatMoney } from '@/utils/money';
import { useProducts } from '@/composables/useProducts';
import { formatProductTitle } from '@/features/marketplace/productPresentation';
import ProductImage from '@/components/marketplace/ProductImage.vue';
import type {
  CaseFileRecommendation,
  ProgressTrend,
  RecommendationStatus,
  TreatmentExtension,
} from '@/types/care';
import { casesApi } from '@/api/cases.api';
import {
  healthAccessRequestRefusal,
  healthProfileAccessView,
} from '@/features/therapist/healthProfileAccess';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';

/** TD5 · Session notes — draft state, lock rule stated inline. */
const route = useRoute();
const router = useRouter();
const toast = useToast();
const id = route.params.id as string;
const { data: caseFile, isPending, error: loadError, refetch } = useCaseFile(id);

/** A 404 is the record genuinely not being there for this therapist; anything
 *  else is the request failing, which is a different thing to tell them. */
const notFound = computed(
  () => loadError.value instanceof ApiError && loadError.value.status === 404,
);

const loadErrorMessage = computed(() =>
  loadError.value instanceof ApiError
    ? loadError.value.message
    : 'Check your connection and try again.',
);

// --- The case as a course of treatment ---------------------------------------
const stage = computed(() => caseStage(caseFile.value));

/* ---- Progress record and treatment extension ------------------------- */

const TRENDS: { value: ProgressTrend; label: string }[] = [
  { value: 'improving', label: 'Improving' },
  { value: 'unchanged', label: 'Unchanged' },
  { value: 'worsening', label: 'Worsening' },
];

const treatmentStarted = computed(() => !!caseFile.value?.treatmentStartedAt);
const progressReports = computed(() => caseFile.value?.progressReports ?? []);
/** Newest last in the payload, and an extension list reads as a history, so it
 *  is shown in the order it happened. */
const extensions = computed(() => caseFile.value?.treatmentExtensions ?? []);

const progressOpen = ref(false);
const progressDay = ref('');
const progressTrend = ref<ProgressTrend>('improving');
const progressCondition = ref('');
const progressProducts = ref('');
const progressTechniques = ref('');
const progressError = ref('');

const extendOpen = ref(false);
const extendDate = ref('');
const extendVisits = ref(0);
const extendReason = ref('');
const extendError = ref('');
const withdrawingId = ref<string | null>(null);

/**
 * Says which of the two things the therapist is about to do. Extra visits are a
 * purchase the client has to agree to, so the sheet must not imply the window
 * moves when it will not.
 */
const extendVisitsNote = computed(() =>
  extendVisits.value > 0
    ? 'They are asked to buy these before the window moves. Nothing changes until they do.'
    : 'Zero is fine — that is more time on the visits they already have, and it applies straight away.',
);

function extensionLabel(e: TreatmentExtension) {
  if (e.status === 'awaiting-payment') return 'WAITING ON PAYMENT';
  if (e.status === 'withdrawn') return 'WITHDRAWN';
  return 'APPLIED';
}

function extensionTone(e: TreatmentExtension): 'success' | 'warning' | 'default' {
  if (e.status === 'awaiting-payment') return 'warning';
  if (e.status === 'withdrawn') return 'default';
  return 'success';
}

async function onWithdrawExtension(e: TreatmentExtension) {
  if (withdrawingId.value || !caseFile.value) return;
  withdrawingId.value = e.id;
  try {
    await casesApi.withdrawExtension(caseFile.value.caseId, e.id);
    await queryClient.invalidateQueries({ queryKey: ['case-files'] });
    await queryClient.invalidateQueries({ queryKey: ['case-bill'] });
    await toast.show('They will no longer be asked to pay for it.', 'success', {
      title: 'Offer withdrawn',
    });
  } catch (error) {
    await reportCaseError(error, 'Could not withdraw that');
  } finally {
    withdrawingId.value = null;
  }
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function openProgressSheet() {
  // Defaults to today because most reports are written on the day; a therapist
  // writing up Friday's session on Monday changes it, which is the point of
  // the field being there at all.
  progressDay.value = todayIso();
  progressTrend.value = 'improving';
  progressCondition.value = '';
  progressProducts.value = '';
  progressTechniques.value = '';
  progressError.value = '';
  progressOpen.value = true;
}

function openExtendSheet() {
  extendDate.value = '';
  extendVisits.value = 0;
  extendReason.value = '';
  extendError.value = '';
  extendOpen.value = true;
}

function trendLabel(trend: ProgressTrend) {
  return TRENDS.find((t) => t.value === trend)?.label ?? String(trend);
}

/** Worsening is not an error the therapist made, so it reads as a warning
 *  rather than a failure; an unrecognised value stays neutral. */
function trendTone(trend: ProgressTrend): 'success' | 'warning' | 'default' {
  if (trend === 'improving') return 'success';
  if (trend === 'worsening') return 'warning';
  return 'default';
}

function formatDay(iso: string | null | undefined) {
  if (!iso) return 'not set';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 'not set';
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function onSaveProgress() {
  if (busyAction.value || !caseFile.value) return;
  if (!progressCondition.value.trim()) {
    progressError.value = 'Say how the client is responding — the rest is optional.';
    return;
  }

  progressError.value = '';
  busyAction.value = 'progress';
  try {
    await casesApi.addProgressReport(caseFile.value.caseId, {
      condition: progressCondition.value,
      productsAdministered: progressProducts.value,
      techniques: progressTechniques.value,
      trend: progressTrend.value,
      recordedFor: progressDay.value || todayIso(),
    });
    await queryClient.invalidateQueries({ queryKey: ['case-files'] });
    progressOpen.value = false;
    await toast.show('It is on the case file.', 'success', { title: 'Progress recorded' });
  } catch (error) {
    progressError.value =
      error instanceof ApiError ? error.message : 'We could not save that. Please try again.';
  } finally {
    busyAction.value = null;
  }
}

async function onExtend() {
  if (busyAction.value || !caseFile.value) return;
  if (!extendDate.value) {
    extendError.value = 'Pick the new end date.';
    return;
  }
  if (!extendReason.value.trim()) {
    extendError.value = 'Say why this course needs longer.';
    return;
  }

  const addedVisits = Math.max(0, Math.trunc(extendVisits.value || 0));
  const wantsVisits = addedVisits > 0;

  extendError.value = '';
  busyAction.value = 'extend';
  try {
    await casesApi.extendTreatment(caseFile.value.caseId, {
      endDate: extendDate.value,
      addedVisits,
      reason: extendReason.value,
    });
    await queryClient.invalidateQueries({ queryKey: ['case-files'] });
    await queryClient.invalidateQueries({ queryKey: ['case-bill'] });
    extendOpen.value = false;
    // Two outcomes, and reporting the wrong one would be a lie about whether
    // the client can book those sessions.
    await toast.show(
      wantsVisits
        ? 'They have been asked to pay for the extra visits. The window moves once they do.'
        : 'The treatment window now runs longer.',
      'success',
      { title: wantsVisits ? 'Extension offered' : 'Treatment extended' },
    );
  } catch (error) {
    extendError.value =
      error instanceof ApiError ? error.message : 'We could not extend it. Please try again.';
  } finally {
    busyAction.value = null;
  }
}
const plan = computed(() => caseFile.value?.treatmentPlan);
const subscription = computed(() => caseFile.value?.subscription ?? null);
const busyAction = ref<string | null>(null);
const closing = ref(false);
const closingSummary = ref('');
const closingError = ref('');

/**
 * What closing actually costs the client, in their own figures.
 *
 * The vaguer version of this sentence ("paid visits are unaffected") was true
 * of the record and false everywhere the client could reach: a closed case
 * refused every booking. The server now allows bookings until the rollover
 * date, so the sheet names it rather than reassuring in the abstract.
 */
const closingConsequence = computed(() => {
  const sub = subscription.value;
  const base = 'Closing ends the course of treatment. The record stays readable to you both.';

  if (!sub || sub.visitsRemaining <= 0) return base;

  const visits = `${sub.visitsRemaining} paid visit${sub.visitsRemaining === 1 ? '' : 's'}`;
  if (!sub.rolloverEndsAt) {
    return `${base} They keep ${visits} and can still book them.`;
  }
  return `${base} They keep ${visits}, bookable until ${formatDate(sub.rolloverEndsAt)}.`;
});

const planSubtitleLine = computed(() => {
  const current = plan.value;
  if (!current?.cadence) return 'Not set yet';
  const window =
    current.startDate && current.endDate
      ? formatDate(current.startDate) + ' – ' + formatDate(current.endDate)
      : 'window not set';
  return cadenceLabel(current.cadence) + ' · ' + window;
});

/**
 * The recommendations, summed. Safe to show: the server recomputes it on every
 * recommendation change and each line holds the price at the time it was
 * recommended, so it does not drift when a product is repriced later (§17.1).
 */
const medicationTotal = computed(() => {
  const total = caseFile.value?.medicationTotal;
  if (typeof total !== 'number' || total <= 0) return null;
  const count = caseFile.value?.recommendations.length ?? 0;
  return `${count} product${count === 1 ? '' : 's'} · ${formatMoney(total, 'USD')}`;
});

const summary = computed(() => subscriptionSummary(subscription.value));
const subscriptionLine = computed(() =>
  summary.value
    ? [summary.value.visits, summary.value.renewal].filter(Boolean).join(' · ')
    : 'Not paid for yet',
);
const subscriptionTone = computed(() =>
  summary.value?.tone === 'warning' ? ('warning' as const) : undefined,
);

interface StageAction {
  key: string;
  label: string;
  primary: boolean;
  /** Nothing consumes the result — a navigation promise and a plain
   *  assignment are both legitimate here, so the return type stays open. */
  run: () => unknown;
}

/**
 * What the therapist can do from here. Built from the stage rather than shown
 * always and disabled: a control that cannot work is worse than one that is not
 * there, and "waiting on the client" has no therapist action at all.
 */
const stageActions = computed<StageAction[]>(() => {
  const goToPlan: StageAction = {
    key: 'plan',
    label: plan.value?.cadence ? 'Edit the plan' : 'Work out a plan',
    primary: true,
    run: () => router.push({ name: 'treatment-plan', params: { id } }),
  };

  switch (stage.value.stage) {
    case 'assessment':
      // Nothing to add: the diagnosis field below this card is the action.
      return [];
    case 'planning':
      return [goToPlan];
    case 'awaiting-payment':
      // Theirs to do, so the only thing offered is a way to talk about it.
      return [{ key: 'chat', label: 'Message them', primary: false, run: goMessages }];
    case 'ready-to-start':
      return [
        { key: 'start', label: 'Start treatment', primary: true, run: onStartTreatment },
        { ...goToPlan, primary: false },
      ];
    case 'in-treatment':
      return [
        { key: 'schedule', label: 'Schedule a session', primary: true, run: goSchedule },
        // Offered mid-course too, not only after it runs out: a therapist who
        // can already see the window is too short should not have to wait for
        // it to expire — and a lapsed window stops sessions being scheduled.
        { key: 'extend', label: 'Extend treatment', primary: false, run: openExtendSheet },
        { key: 'close', label: 'Close case', primary: false, run: () => (closing.value = true) },
      ];
    case 'follow-up':
      // The course has run and the client is not done. Extending is the first
      // thing offered here because it is the answer when they are simply not
      // better yet — closing the case and opening another loses the history.
      return [
        { key: 'extend', label: 'Extend treatment', primary: true, run: openExtendSheet },
        { key: 'follow-up', label: 'Book a follow-up', primary: false, run: onFollowUp },
        { key: 'close', label: 'Close case', primary: false, run: () => (closing.value = true) },
      ];
    default:
      return [];
  }
});

function cadenceLabel(cadence: string): string {
  const labels: Record<string, string> = {
    weekly: '1 visit a week',
    'twice-weekly': '2 visits a week',
    'thrice-weekly': '3 visits a week',
    custom: 'Custom cadence',
  };
  return labels[cadence] ?? cadence;
}

function goSchedule() {
  if (!canScheduleSessions(caseFile.value)) return;
  router.push({
    name: 'therapist-calendar',
    query: { case: id, client: caseFile.value?.clientId ?? '' },
  });
}

async function onStartTreatment() {
  if (busyAction.value || !caseFile.value) return;
  busyAction.value = 'start';
  try {
    await casesApi.start(caseFile.value.caseId);
    await queryClient.invalidateQueries({ queryKey: ['case-files'] });
    await toast.show('You can schedule sessions against their plan now.', 'success', {
      title: 'Treatment started',
    });
  } catch (error) {
    await reportCaseError(error, 'Could not start treatment');
  } finally {
    busyAction.value = null;
  }
}

async function onFollowUp() {
  if (busyAction.value || !caseFile.value) return;
  busyAction.value = 'follow-up';
  try {
    // Two weeks out is a default the therapist can move, not a rule — the
    // server records whatever date it is sent.
    const dueAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await casesApi.scheduleFollowUp(
      caseFile.value.caseId,
      dueAt,
      'Review after the treatment window.',
    );
    await queryClient.invalidateQueries({ queryKey: ['case-files'] });
    await toast.show('They will be reminded, and so will you.', 'success', {
      title: 'Follow-up booked',
    });
  } catch (error) {
    await reportCaseError(error, 'Could not book that follow-up');
  } finally {
    busyAction.value = null;
  }
}

async function onCloseCase() {
  if (!caseFile.value) return;
  if (!closingSummary.value.trim()) {
    // Mirrors the server's rule rather than sending a blank to be refused: a
    // case that ends with no account of how it ended is unusable later.
    closingError.value = 'Say how this course of treatment ended.';
    return;
  }
  busyAction.value = 'close';
  closingError.value = '';
  try {
    await casesApi.close(caseFile.value.caseId, closingSummary.value.trim());
    await queryClient.invalidateQueries({ queryKey: ['case-files'] });
    closing.value = false;
    closingSummary.value = '';
    await toast.show('The record stays readable to both of you.', 'success', {
      title: 'Case closed',
    });
  } catch (error) {
    await reportCaseError(error, 'Could not close this case');
  } finally {
    busyAction.value = null;
  }
}

async function reportCaseError(error: unknown, title: string) {
  // The case may have moved on in another session, so this refetches before
  // reporting — the message should describe what is true now.
  await queryClient.invalidateQueries({ queryKey: ['case-files'] });
  const message =
    error instanceof ApiError ? error.message : 'Check your connection and try again.';
  await toast.show(message, 'warning', { title });
}

// --- Health profile access ---------------------------------------------------
const queryClient = useQueryClient();
const reasonDraft = ref('');
const asking = ref(false);

const clientId = computed(() => caseFile.value?.clientId ?? '');
const accessGranted = computed(() => caseFile.value?.healthProfileAccess?.status === 'granted');
const {
  data: profile,
  isPending: profileLoading,
  error: profileError,
} = useClientHealthProfile(clientId, accessGranted);

/** vue-query reports a disabled query as pending forever, so the spinner has to
 *  be gated on the fetch actually being allowed to run. */
const profilePending = computed(() => accessGranted.value && profileLoading.value && !profile.value);

const access = computed(() => healthProfileAccessView(caseFile.value?.healthProfileAccess, profileError.value));

const accessTone = computed(() => {
  if (access.value.kind === 'granted') return 'var(--cc-color-primary)';
  if (access.value.kind === 'lapsed' || access.value.kind === 'unavailable') {
    return 'var(--cc-color-warning)';
  }
  return 'var(--cc-ink-400)';
});

async function onAskForAccess() {
  if (!clientId.value || asking.value) return;
  asking.value = true;
  try {
    await healthAccessApi.request(clientId.value, reasonDraft.value);
    reasonDraft.value = '';
    // The case file carries the access state, so it is what has gone stale.
    await queryClient.invalidateQueries({ queryKey: ['case-files'] });
    await toast.show(
      'They will be asked to allow it. You will hear when they answer.',
      'success',
      { title: 'Request sent' },
    );
  } catch (error) {
    // A 409 means this screen was looking at a stale answer, so refetching is
    // the fix and the message says what is actually true now.
    await queryClient.invalidateQueries({ queryKey: ['case-files'] });
    await toast.show(healthAccessRequestRefusal(error), 'warning', { title: 'Not sent' });
  } finally {
    asking.value = false;
  }
}

const draftNote = ref('');

/** Seeded from the file and re-seeded when it changes underneath, so the field
 *  shows what is stored rather than a stale edit. */
const diagnosisDraft = ref('');
const diagnosisError = ref('');
const savingDiagnosis = ref(false);
const canEdit = computed(() => canEditDiagnosis(caseFile.value));
const diagnosisChanged = computed(
  () => diagnosisDraft.value.trim() !== (caseFile.value?.diagnosis ?? '').trim(),
);

watch(
  () => caseFile.value?.diagnosis,
  (next) => {
    diagnosisDraft.value = next ?? '';
  },
  { immediate: true },
);

async function onSaveDiagnosis() {
  const value = diagnosisDraft.value.trim();
  if (!value) {
    // Mirrors the server's rule rather than sending a blank to be refused.
    diagnosisError.value = 'A diagnosis can be corrected, but not erased.';
    return;
  }

  savingDiagnosis.value = true;
  diagnosisError.value = '';
  try {
    await caseFilesApi.setDiagnosis(id, value);
    await refetch();
    await toast.show('Diagnosis recorded', 'success');
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error
        : 'We could not save the diagnosis. Please try again.';
    if (error instanceof ApiError && error.code === 'diagnosis_not_clearable') {
      diagnosisError.value = error.message;
    } else {
      await toast.show(message, 'danger', { title: 'Could not save diagnosis' });
    }
  } finally {
    savingDiagnosis.value = false;
  }
}
const savingNote = ref(false);

async function onAddNote() {
  if (!draftNote.value.trim()) return;
  savingNote.value = true;
  try {
    await caseFilesApi.addNote(id, draftNote.value.trim(), true);
    draftNote.value = '';
    await refetch();
  } finally {
    savingNote.value = false;
  }
}

/**
 * The conversation with this client. A thread is opened server-side with the
 * working relationship, so one normally exists by the time a case file does —
 * but the client cannot open one, so its absence is a state, not an error.
 */
const { data: chatThreads } = useChatThreads();
const clientThread = computed(() => findThreadWith(chatThreads.value, caseFile.value?.clientId));

/** Read from the notes themselves rather than `unwrittenNoteFrom`: the two
 *  can disagree while a save is in flight, and the list is what is rendered. */
const hasUnwrittenNotes = computed(() => (caseFile.value?.notes ?? []).some((n) => n.draft));

const notesSubtitle = computed(() => {
  const file = caseFile.value;
  if (!file) return '';
  const written = file.notes.filter((n) => !n.draft).length;
  const unwritten = file.notes.filter((n) => n.draft).length;
  const base = `${written} written`;
  // The count matters: "one unwritten" beside two drafts understates the work.
  return unwritten ? `${base} · ${unwritten} unwritten` : base;
});

const messagesSubtitle = computed(() => {
  const thread = clientThread.value;
  if (!thread) return 'No conversation open yet';
  if (thread.unreadCount > 0) {
    return `${thread.unreadCount} unread`;
  }
  return thread.lastMessageAt ? `Last reply ${formatDate(thread.lastMessageAt)}` : 'No messages yet';
});

/**
 * Browse the catalogue on the client's behalf. The case travels in the query
 * so the shop can swap its buy action for "add to treatment plan" — a
 * recommendation belongs on the client's case, never in the therapist's cart.
 */
/**
 * The catalogue name for a recommended line. The case endpoint returns only
 * ids, so the name is looked up from products already in the cache; a line
 * whose product is not in the current page falls back to naming itself rather
 * than rendering an empty heading.
 */
/** Only for naming recommended lines; the case endpoint sends ids alone. */
const { data: productPage } = useProducts({});
const products = computed(() => productPage.value?.data ?? []);

function recommendationName(r: CaseFileRecommendation) {
  if (r.productName) return formatProductTitle(r.productName);
  const match = products.value.find((p) => p.id === r.productId);
  return match ? formatProductTitle(match.name) : 'Product not in the catalogue';
}

const removingLine = ref<string | null>(null);

/** Readable by both sides of the case; the therapist needs to know whether the
 *  products they put on a plan have actually been paid for. */
const { data: bill } = useCaseBill(() => caseFile.value?.caseId ?? '');

function statusLabel(status: RecommendationStatus) {
  return status === 'accepted' ? 'ACCEPTED' : 'AWAITING CLIENT';
}

function statusTone(status: RecommendationStatus) {
  return status === 'accepted' ? ('success' as const) : ('default' as const);
}

/** Says who the line is waiting on, and whether it is costing anything yet —
 *  only an accepted line is money the client owes. */
function statusDetail(r: CaseFileRecommendation) {
  if (r.status === 'accepted') {
    const paid = r.paidMinor ?? 0;
    return paid > 0
      ? `Paid ${formatMinor(paid, r.currency)} of ${formatMinor(r.totalMinor, r.currency)}`
      : 'On their bill, not paid yet';
  }
  // No declined state: a line the client does not want stays here until the
  // therapist takes it off, which is why Remove is on this card.
  return 'Waiting for the client to accept';
}

async function onRemoveRecommendation(r: CaseFileRecommendation) {
  if (removingLine.value || r.removable === false) return;
  removingLine.value = r.id;
  try {
    await casesApi.removeRecommendation(caseFile.value!.caseId, r.id);
    await queryClient.invalidateQueries({ queryKey: ['case-files'] });
    await queryClient.invalidateQueries({ queryKey: ['case-bill'] });
    await toast.show('It is off their bill.', 'success', { title: 'Removed' });
  } catch (error) {
    await reportCaseError(error, 'Could not remove that');
  } finally {
    removingLine.value = null;
  }
}

function goRecommend() {
  router.push({
    name: 'catalog',
    query: { recommendFor: id, client: caseFile.value?.clientName ?? '' },
  });
}

function goMessages() {
  const thread = clientThread.value;
  // Falling back to the inbox rather than dead-ending: the thread may exist
  // under a participant this screen cannot see.
  if (thread) router.push({ name: 'chat-thread', params: { id: thread.id } });
  else router.push({ name: 'chat-inbox' });
}

/** Either end may be missing on a file nobody has filled in yet, so the two
 *  dates are only shown as a range once both exist. */
const treatmentWindow = computed(() => {
  const start = caseFile.value?.treatmentStartDate;
  const end = caseFile.value?.treatmentEndDate;
  if (start && end) return `${formatDate(start)} — ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  if (end) return `Until ${formatDate(end)}`;
  return null;
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}
</script>

<style scoped>
.cc-reco__thumb {
  flex: none;
  width: 46px;
  height: 46px;
  border-radius: var(--cc-radius-sm);
  overflow: hidden;
  background: var(--cc-color-mist);
}
.cc-reco__cost {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--cc-divider);
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
}
.cc-reco-bill {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 13px 15px;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-lg);
  background: var(--cc-surface-0);
  margin-bottom: 4px;
}
.cc-reco-bill > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
}
.cc-reco-bill__due {
  padding-top: 6px;
  border-top: 1px solid var(--cc-divider);
}
.cc-reco-bill__due span,
.cc-reco-bill__due :deep(.cc-money) {
  color: var(--cc-ink-900);
  font-weight: 600;
}
.cc-reco__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
.cc-reco__cost > :last-child {
  color: var(--cc-ink-900);
  font-weight: 600;
}

.cc-stage {
  border-left: 3px solid var(--cc-color-primary);
}

.cc-stage--client {
  border-left-color: var(--cc-color-warning);
}

.cc-stage--nobody {
  border-left-color: var(--cc-color-success);
}

.cc-stage__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.cc-stage__label {
  font-size: 15.5px;
  font-weight: 700;
}

.cc-stage__detail {
  margin: 4px 0 0;
  font-size: 13.5px;
  line-height: 1.5;
  color: var(--cc-ink-400);
}

.cc-stage__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.cc-close__error {
  margin: 6px 0 10px;
  font-size: 12.5px;
  color: var(--cc-error-surface-text);
}

/* ---- Progress record and extension ---- */
.cc-progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cc-progress__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.cc-progress__line {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cc-progress__line p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 13px;
  line-height: 1.5;
  color: var(--cc-ink-600);
}
.cc-progress__empty {
  margin: 0;
}
.cc-progress__label {
  display: block;
  margin: 12px 0 5px;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--cc-ink-900);
}
/* A plain control rather than AppInput: `date` and `number` need the native
   pickers, and AppInput is a text field with its own chrome. */
.cc-input-native {
  width: 100%;
  min-height: var(--cc-touch-min);
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-sm);
  background: var(--cc-surface-0);
  font-family: var(--cc-font-interface);
  font-size: 14.5px;
  color: var(--cc-ink-900);
}
.cc-progress__trends {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.cc-progress__trend {
  flex: none;
  min-height: 40px;
  padding: 8px 14px;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-pill);
  background: var(--cc-surface-0);
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--cc-ink-600);
  cursor: pointer;
}
.cc-progress__trend--on {
  background: var(--cc-color-primary);
  border-color: var(--cc-color-primary);
  color: #fff;
}
.cc-extensions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-extensions__row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
}
.cc-extensions__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  flex-wrap: wrap;
}
.cc-extensions__pending {
  margin: 0;
  padding: 9px 11px;
  border-radius: var(--cc-radius-sm);
  background: var(--cc-color-warning-tint);
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 18px;
  color: var(--cc-ink-600);
}
.cc-extensions__row p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 13px;
  line-height: 1.5;
  color: var(--cc-ink-600);
}

.cc-hp__head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
}

.cc-hp__headings {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cc-hp__sections {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0 0 12px;
  padding-top: 12px;
  border-top: 1px solid var(--cc-divider);
}

.cc-hp__section {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.cc-hp__sections dd {
  margin: 0;
}

.cc-record__label {
  margin: 4px 0 -4px;
  font-family: var(--cc-font-interface);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--cc-ink-400);
}
.cc-record__tiles {
  display: flex;
  gap: 8px;
}
.cc-record__tile {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.cc-record__tile-label {
  font-family: var(--cc-font-interface);
  font-size: 10.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--cc-ink-400);
}
.cc-record__tile-value {
  font-family: var(--cc-font-interface);
  font-size: 22px;
  font-weight: 700;
  color: var(--cc-ink-900);
  font-variant-numeric: tabular-nums;
}
.cc-diagnosis {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--cc-divider);
}
.cc-unset {
  color: var(--cc-ink-400);
  font-weight: 500;
}
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}
.cc-section-head {
  margin-top: 6px;
}
.cc-textarea {
  width: 100%;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-sm);
  padding: 10px 12px;
  font-family: var(--cc-font-interface);
  font-size: 13.5px;
  box-sizing: border-box;
  resize: vertical;
}
.cc-recommendations {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 6px;
}
.cc-recommendations__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.cc-recommendations__heading h2 {
  margin: 0;
  color: var(--cc-ink-900);
  font-family: var(--cc-font-interface);
  font-size: 16px;
  line-height: 22px;
}
.cc-recommendations__heading p {
  margin: 2px 0 0;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 16px;
}
.cc-recommendations__add {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-height: 34px;
  padding: 0 8px;
  border: none;
  border-radius: var(--cc-radius-sm);
  background: var(--cc-color-mist);
  color: var(--cc-color-primary-dark);
  font-family: var(--cc-font-interface);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.cc-recommendations__empty {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 14px;
  border: 1px dashed var(--cc-line);
  border-radius: var(--cc-radius-md);
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
}
.cc-reco {
  padding: 14px;
}
.cc-reco__top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cc-reco__product {
  min-width: 0;
  flex: 1;
}
.cc-reco__product .cc-text-mono {
  display: block;
  margin-bottom: 2px;
  color: var(--cc-ink-400);
  font-size: 9.5px;
  line-height: 14px;
  letter-spacing: 0.06em;
}
.cc-reco__product h3 {
  margin: 0;
  overflow: hidden;
  color: var(--cc-ink-900);
  font-family: var(--cc-font-interface);
  font-size: 14px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cc-reco__guidance {
  display: flex;
  gap: 8px;
  margin-top: 13px;
  padding: 10px;
  border-radius: 10px;
  background: var(--cc-surface-1);
}
.cc-reco__guidance > div {
  min-width: 0;
}
/* Same reason as the payout card: a bare `span` also matches the icon root. */
.cc-reco__guidance > div > span {
  display: block;
  margin-bottom: 2px;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 10.5px;
  font-weight: 600;
}
.cc-reco__guidance p {
  margin: 0;
  color: var(--cc-ink-900);
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 18px;
}
.cc-reco__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--cc-divider);
}
.cc-reco__footer > span {
  color: var(--cc-ink-400);
  font-family: var(--cc-font-interface);
  font-size: 10.5px;
  line-height: 15px;
}
.cc-reco__footer :deep(.cc-btn) {
  min-height: 36px;
  padding: 0 12px;
  white-space: nowrap;
}
</style>
