<template>
  <ion-page>
    <AppHeader title="Health profile" show-back :botanical="false">
    </AppHeader>
    <ion-content class="cc-screen">
      <LoadingState v-if="isPending" label="Loading your health profile…" />
      <div v-else class="cc-screen__pad">
        <!-- A therapist asking to read this is the only thing on the screen
             waiting on the client, so it sits above the consent line rather
             than three taps away under Security & privacy. It leads to the
             answer instead of carrying Allow itself: the reason they gave and
             everyone else's standing are on that screen, and consent asked for
             without them is consent asked for blind. -->
        <button
          v-if="pendingAccess.length"
          type="button"
          class="cc-hp__ask"
          @click="router.push({ name: 'health-profile-access' })"
        >
          <AppIcon name="pending_actions" :size="22" color="var(--cc-color-warning)" />
          <span class="cc-hp__ask-body">
            <span class="cc-hp__ask-title">{{ askTitle }}</span>
            <span class="cc-hp__ask-sub">Waiting for your answer</span>
          </span>
          <AppIcon name="chevron_right" :size="20" color="var(--cc-ink-400)" />
        </button>

        <div class="cc-hp__consent">
          <AppIcon name="shield_lock" :size="22" color="var(--cc-color-primary)" />
          <p>
            Encrypted and visible only to your assigned therapist and authorised admins. Consent
            {{ profile?.consentVersion ?? 'not yet given' }}.
          </p>
        </div>

        <div class="cc-hp__progress-row">
          <span class="cc-text-body">Profile completeness</span>
          <span class="cc-text-mono">{{ filledCount }} of {{ countedSections.length }}</span>
        </div>
        <div class="cc-progress"><div class="cc-progress__fill" :style="{ width: `${completion}%` }" /></div>

        <AppCard style="padding: 0">
          <AppListRow
            v-for="s in sections"
            :key="s.key"
            :title="`${s.label}: (${sectionHints[s.key]})`"
            :subtitle="s.value ?? 'Not provided'"
            :icon="s.value ? 'check_circle' : 'error'"
            :icon-color="s.value ? 'var(--cc-color-success)' : 'var(--cc-color-warning)'"
            chevron
            clickable
            @click="editSection(s)"
          />
        </AppCard>
      </div>
    </ion-content>

    <div class="cc-screen__footer">
      <AppButton :loading="saving" @click="onSave">Save health profile</AppButton>
    </div>

    <AppSheet v-model="sheetOpen" :title="editing?.label">
      <textarea
        v-model="draftValue"
        class="cc-hp__textarea"
        :rows="editing && OPTIONAL_SECTIONS.has(editing.key) ? 7 : 4"
        :placeholder="editing ? sectionPlaceholders[editing.key] : ''"
      />
      <AppButton style="margin-top: 12px" @click="saveSection">Done</AppButton>
    </AppSheet>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppButton, AppCard, AppHeader, AppIcon, AppListRow, AppSheet } from '@/components/ui';
import { LoadingState } from '@/components/state';
import { healthProfileApi } from '@/api/case-files.api';
import { useHealthProfile } from '@/composables/useCaseFiles';
import { usePendingHealthAccess } from '@/composables/useHealthAccess';
import { useToast } from '@/composables/useToast';
import type { HealthProfileSection } from '@/types/care';

/** D3 · Health profile — consent up top, sections named not scolded when empty. */
const { data: profile, isPending, refetch } = useHealthProfile();
const toast = useToast();
const router = useRouter();
const route = useRoute();

/**
 * Therapists waiting on an answer. Not gated on `isPending` above: this list
 * loads separately, so the banner appears when it arrives rather than holding
 * the profile back.
 */
const { pending: pendingAccess } = usePendingHealthAccess();

const askTitle = computed(() => {
  const rows = pendingAccess.value;
  if (rows.length === 1) {
    // Named where we can. "A therapist asked" is the same sentence about a
    // stranger, and the client is being asked to decide about a person.
    return `${rows[0].therapistName ?? 'Your therapist'} asked to read this`;
  }
  return `${rows.length} therapists asked to read this`;
});

const sectionPlaceholders: Record<HealthProfileSection['key'], string> = {
  basics: '34 yrs · 68 kg · 1.66 m',
  conditions: 'e.g. Mild scoliosis, managed with physiotherapy',
  allergies: 'e.g. Penicillin, shellfish',
  medications: 'e.g. Metformin 500mg, twice daily',
  lifestyle: 'e.g. Mostly vegetarian, exercises 3x a week',
  labResults: 'e.g. FBC 12 Aug — haemoglobin 11.2 g/dL, everything else normal',
  additional: 'Anything else your therapist should know — past surgery, family history, what you have already tried.',
};

/**
 * A short example after each row's name, so the list says what kind of answer
 * a section wants before it is opened. Kept shorter than the sheet's
 * placeholder: the row title wraps, and a full sentence would swamp the list.
 */
const sectionHints: Record<HealthProfileSection['key'], string> = {
  basics: '34 yrs, 68 kg, 1.66 m',
  conditions: 'Mild scoliosis',
  allergies: 'Penicillin, shellfish',
  medications: 'Metformin 500mg',
  lifestyle: 'Mostly vegetarian',
  labResults: 'FBC, haemoglobin',
  additional: 'Past surgery, family history',
};

const defaultSections: HealthProfileSection[] = [
  { key: 'basics', label: 'Basics', value: null },
  { key: 'conditions', label: 'Existing conditions', value: null },
  { key: 'allergies', label: 'Allergies', value: null },
  { key: 'medications', label: 'Current medications', value: null },
  { key: 'lifestyle', label: 'Lifestyle & diet', value: null },
  /**
   * Last two on purpose: both are open-ended, and a long free-text box at the
   * top makes the five specific questions above it look optional.
   *
   * Lab results are typed in rather than attached. The API takes
   * `sections[].value` as text and there is no endpoint to upload a report to
   * — see the backend note — so this records what the results *said*, which is
   * what a therapist reads anyway, and the document itself follows later.
   */
  { key: 'labResults', label: 'Laboratory test results', value: null },
  { key: 'additional', label: 'Additional details', value: null },
];
/**
 * Local editable copy. This used to be a computed that saveSection() mutated
 * in place — which silently edited either the query cache or the shared
 * defaultSections constant, and never re-rendered, so filling in a section
 * appeared to do nothing.
 */
const sections = ref<HealthProfileSection[]>(defaultSections.map((d) => ({ ...d })));

watch(
  profile,
  (p) => {
    const existing = p?.sections ?? [];
    sections.value = defaultSections.map((d) => {
      const match = existing.find((e) => e.key === d.key);
      return match ? { ...match } : { ...d };
    });
  },
  { immediate: true },
);
/**
 * Completeness counts the questions with an answer, not the invitations.
 *
 * Lab results and additional details are open-ended — plenty of clients have
 * neither, and counting them would cap an otherwise finished profile at 71%
 * and imply something is still missing when nothing is.
 */
const OPTIONAL_SECTIONS = new Set(['labResults', 'additional']);
const countedSections = computed(() =>
  sections.value.filter((s) => !OPTIONAL_SECTIONS.has(s.key)),
);
const filledCount = computed(() => countedSections.value.filter((s) => s.value).length);
const completion = computed(() =>
  Math.round((filledCount.value / Math.max(1, countedSections.value.length)) * 100),
);

const sheetOpen = ref(false);
const editing = ref<HealthProfileSection | null>(null);
const draftValue = ref('');
const saving = ref(false);

function editSection(s: HealthProfileSection) {
  editing.value = s;
  draftValue.value = s.value ?? '';
  sheetOpen.value = true;
}

function saveSection() {
  if (!editing.value) return;
  const key = editing.value.key;
  sections.value = sections.value.map((s) =>
    s.key === key ? { ...s, value: draftValue.value.trim() || null } : s,
  );
  sheetOpen.value = false;
}

async function onSave() {
  saving.value = true;
  try {
    await healthProfileApi.update(sections.value, profile.value?.consentVersion ?? 'v1');
    await refetch();
    await toast.show('Health profile updated', 'success');
    if (route.query.returnTo === 'health-profile-gate') {
      router.replace({ name: 'health-profile-gate' });
      return;
    }
    if (window.history.state?.back) router.back();
    else router.replace({ name: 'care-hub' });
  } catch {
    await toast.show('Could not save your health profile. Please try again.', 'danger');
  } finally {
    saving.value = false;
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
  gap: 14px;
}
.cc-hp__ask {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  /* Tinted rather than solid warning: it is a question, not a failure. */
  background: var(--cc-color-warning-tint);
  border: 1px solid color-mix(in srgb, var(--cc-color-warning) 35%, transparent);
  border-radius: var(--cc-radius-lg);
  padding: 12px 14px;
  min-height: 44px;
  font: inherit;
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
}
.cc-hp__ask-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cc-hp__ask-title {
  font-family: var(--cc-font-interface);
  font-size: 14px;
  font-weight: 600;
  color: var(--cc-ink-900);
}
.cc-hp__ask-sub {
  font-family: var(--cc-font-interface);
  font-size: 12px;
  color: var(--cc-ink-600);
}
.cc-hp__consent {
  background: var(--cc-color-mist);
  border-radius: var(--cc-radius-lg);
  padding: 14px;
  display: flex;
  gap: 10px;
}
.cc-hp__consent p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 17px;
  color: var(--cc-ink-600);
}
.cc-hp__progress-row {
  display: flex;
  justify-content: space-between;
}
.cc-progress {
  height: 8px;
  border-radius: 999px;
  background: var(--cc-divider);
}
.cc-progress__fill {
  height: 100%;
  border-radius: 999px;
  background: var(--cc-color-primary);
}
.cc-hp__textarea {
  width: 100%;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-sm);
  padding: 10px 12px;
  font-family: var(--cc-font-interface);
  font-size: 14.5px;
  box-sizing: border-box;
  resize: vertical;
}
.cc-screen__footer {
  padding: 11px 16px calc(25px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
  background: var(--cc-surface-app);
}
</style>
