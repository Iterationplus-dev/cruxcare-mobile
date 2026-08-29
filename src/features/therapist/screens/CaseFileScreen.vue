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
            title="Messages"
            :subtitle="messagesSubtitle"
            icon="forum"
            chevron
            clickable
            :divider="false"
            @click="goMessages"
          />
        </AppCard>

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
            <button type="button" class="cc-recommendations__add" @click="router.push({ name: 'catalog' })">
              <AppIcon name="add" :size="18" />
              Add
            </button>
          </div>

          <div v-if="!caseFile.recommendations.length" class="cc-recommendations__empty">
            <AppIcon name="spa" :size="22" color="var(--cc-color-primary)" />
            <span>No products recommended yet.</span>
          </div>

          <AppCard v-for="r in caseFile.recommendations" :key="r.id" class="cc-reco">
            <div class="cc-reco__top">
              <div class="cc-reco__product-icon">
                <AppIcon name="local_pharmacy" :size="22" color="var(--cc-color-primary)" />
              </div>
              <div class="cc-reco__product">
                <span class="cc-text-mono">CARE RECOMMENDATION</span>
                <h3>{{ r.productName }}</h3>
              </div>
              <AppBadge :label="r.orderId ? 'ORDERED' : 'SUGGESTED'" :tone="r.orderId ? 'success' : 'default'" />
            </div>

            <div v-if="r.note" class="cc-reco__guidance">
              <AppIcon name="info" :size="18" color="var(--cc-color-primary)" />
              <div>
                <span>Suggested use</span>
                <p>{{ r.note }}</p>
              </div>
            </div>

            <div class="cc-reco__footer">
              <span>{{ r.orderId ? 'Added to an order' : 'Awaiting client order' }}</span>
              <AppButton
                variant="secondary"
                :full-width="false"
                @click="router.push({ name: 'product-detail', params: { id: r.productId } })"
              >
                View product
              </AppButton>
            </div>
          </AppCard>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppBadge, AppButton, AppCard, AppHeader, AppIcon, AppInput, AppListRow } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { caseFilesApi } from '@/api/case-files.api';
import { useCaseFile } from '@/composables/useCaseFiles';
import { findThreadWith, useChatThreads } from '@/composables/useChat';
import { canEditDiagnosis } from '@/features/therapist/caseFilePermissions';
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
        ? error.message
        : 'We could not save the diagnosis. Please try again.';
    if (error instanceof ApiError && error.code === 'diagnosis_not_clearable') {
      diagnosisError.value = message;
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
.cc-reco__product-icon {
  width: 42px;
  height: 42px;
  display: grid;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: var(--cc-color-mist);
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
