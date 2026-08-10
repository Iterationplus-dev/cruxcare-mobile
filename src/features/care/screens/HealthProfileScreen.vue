<template>
  <ion-page>
    <AppHeader title="Health profile" show-back :botanical="false">
      <template #actions>
        <button type="button" class="cc-hp__save" :disabled="saving" @click="onSave">Save</button>
      </template>
    </AppHeader>
    <ion-content class="cc-screen">
      <LoadingState v-if="isPending" label="Loading your health profile…" />
      <div v-else class="cc-screen__pad">
        <div class="cc-hp__consent">
          <AppIcon name="shield_lock" :size="22" color="var(--cc-color-primary)" />
          <p>
            Encrypted and visible only to your assigned therapist and authorised admins. Consent
            {{ profile?.consentVersion ?? 'not yet given' }}.
          </p>
        </div>

        <div class="cc-hp__progress-row">
          <span class="cc-text-body">Profile completeness</span>
          <span class="cc-text-mono">{{ filledCount }} of {{ sections.length }}</span>
        </div>
        <div class="cc-progress"><div class="cc-progress__fill" :style="{ width: `${completion}%` }" /></div>

        <AppCard style="padding: 0">
          <AppListRow
            v-for="s in sections"
            :key="s.key"
            :title="s.label"
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

    <AppSheet v-model="sheetOpen" :title="editing?.label">
      <textarea
        v-model="draftValue"
        class="cc-hp__textarea"
        rows="4"
        :placeholder="editing ? sectionPlaceholders[editing.key] : ''"
      />
      <AppButton style="margin-top: 12px" @click="saveSection">Done</AppButton>
    </AppSheet>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppButton, AppCard, AppHeader, AppIcon, AppListRow, AppSheet } from '@/components/ui';
import { LoadingState } from '@/components/state';
import { healthProfileApi } from '@/api/case-files.api';
import { useHealthProfile } from '@/composables/useCaseFiles';
import { useToast } from '@/composables/useToast';
import type { HealthProfileSection } from '@/types/care';

/** D3 · Health profile — consent up top, sections named not scolded when empty. */
const { data: profile, isPending, refetch } = useHealthProfile();
const toast = useToast();
const router = useRouter();

const sectionPlaceholders: Record<HealthProfileSection['key'], string> = {
  basics: '34 yrs · 68 kg · 1.66 m',
  conditions: 'e.g. Mild scoliosis, managed with physiotherapy',
  allergies: 'e.g. Penicillin, shellfish',
  medications: 'e.g. Metformin 500mg, twice daily',
  lifestyle: 'e.g. Mostly vegetarian, exercises 3x a week',
};

const defaultSections: HealthProfileSection[] = [
  { key: 'basics', label: 'Basics', value: null },
  { key: 'conditions', label: 'Existing conditions', value: null },
  { key: 'allergies', label: 'Allergies', value: null },
  { key: 'medications', label: 'Current medications', value: null },
  { key: 'lifestyle', label: 'Lifestyle & diet', value: null },
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
const filledCount = computed(() => sections.value.filter((s) => s.value).length);
const completion = computed(() => Math.round((filledCount.value / sections.value.length) * 100));

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
    // Previously stayed put with no feedback beyond the toast, which read as
    // "nothing happened" and left no way onward from the A4 gate flow.
    if (window.history.state?.back) router.back();
    else router.replace({ name: 'care-hub' });
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.cc-hp__save {
  background: none;
  border: none;
  color: var(--cc-color-primary);
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 14.5px;
  cursor: pointer;
}
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
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
</style>
