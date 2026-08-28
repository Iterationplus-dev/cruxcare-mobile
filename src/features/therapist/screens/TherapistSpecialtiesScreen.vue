<template>
  <ion-page>
    <AppHeader title="Areas of specialization" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <LoadingState v-if="isPending" label="Loading your profile…" />

      <!-- Only a 403 actually means "you don't practise as a therapist". Any
           other failure is the request going wrong, and telling a therapist
           with an active plan to go buy one would be a lie. -->
      <EmptyState
        v-else-if="notATherapist"
        icon="badge"
        title="No therapist profile yet"
        message="Choose a therapist plan first — your public profile is created with it."
        primary-action="Choose a plan"
        @primary="router.push({ name: 'therapist-plan' })"
      />

      <EmptyState
        v-else-if="!profile"
        icon="cloud_off"
        title="Couldn't load your profile"
        :message="loadErrorMessage"
        primary-action="Try again"
        @primary="refetch()"
      />

      <div v-else class="cc-screen__pad">
        <p class="cc-text-body cc-spec__intro">
          Clients see these on your profile when deciding who to ask for. List what you actually
          treat — {{ MAX_SPECIALTIES }} at most.
        </p>

        <section aria-labelledby="chosen-heading">
          <h2 id="chosen-heading" class="cc-text-body-strong cc-spec__heading">
            On your profile
            <span class="cc-text-caption cc-spec__count">{{ selected.length }}/{{ MAX_SPECIALTIES }}</span>
          </h2>

          <AppCard>
            <div v-if="selected.length" class="cc-spec__chips">
              <button
                v-for="item in selected"
                :key="item"
                type="button"
                class="cc-spec__chip cc-spec__chip--on"
                @click="remove(item)"
              >
                <span>{{ item }}</span>
                <AppIcon name="close" :size="15" color="var(--cc-color-primary)" />
              </button>
            </div>
            <p v-else class="cc-text-caption cc-spec__none">
              Nothing listed yet. Clients will see only your bio until you add an area.
            </p>
          </AppCard>
        </section>

        <section aria-labelledby="suggested-heading">
          <h2 id="suggested-heading" class="cc-text-body-strong cc-spec__heading">Common areas</h2>
          <AppCard>
            <div class="cc-spec__chips">
              <button
                v-for="item in unusedSuggestions"
                :key="item"
                type="button"
                class="cc-spec__chip"
                :disabled="atLimit"
                @click="add(item)"
              >
                <AppIcon name="add" :size="15" :color="atLimit ? 'var(--cc-ink-300)' : 'var(--cc-ink-500)'" />
                <span>{{ item }}</span>
              </button>
            </div>
            <p v-if="!unusedSuggestions.length" class="cc-text-caption cc-spec__none">
              You've added all the common areas. Use the field below for anything else.
            </p>
          </AppCard>
        </section>

        <section aria-labelledby="custom-heading">
          <h2 id="custom-heading" class="cc-text-body-strong cc-spec__heading">Something else</h2>
          <AppInput
            v-model="customEntry"
            label="Add your own"
            placeholder="e.g. Lymphatic drainage"
            :error="entryError"
            :helper="`Up to ${MAX_SPECIALTY_LENGTH} characters`"
            @keyup.enter="addCustom"
          />
          <AppButton variant="secondary" :disabled="atLimit" @click="addCustom">Add area</AppButton>
        </section>
      </div>

      <div v-if="profile" class="cc-screen__footer">
        <AppButton :loading="saving" :disabled="!dirty" @click="onSave">
          {{ dirty ? 'Save changes' : 'Saved' }}
        </AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { AppButton, AppCard, AppHeader, AppIcon, AppInput } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { therapistsApi } from '@/api/therapists.api';
import { useToast } from '@/composables/useToast';
import {
  MAX_SPECIALTIES,
  MAX_SPECIALTY_LENGTH,
  SPECIALTY_SUGGESTIONS,
  addSpecialty,
  removeSpecialty,
} from '@/features/therapist/specialties';
import { ApiError } from '@/types/api';

/**
 * Lets a therapist state what they treat. The same list is what clients read on
 * the therapist's public profile, so edits are staged locally and only written
 * when saved — a mistapped chip should not immediately change what clients see.
 */
const router = useRouter();
const toast = useToast();
const queryClient = useQueryClient();

const {
  data: profile,
  isPending,
  error: loadError,
  refetch,
} = useQuery({
  queryKey: ['therapist', 'my-profile'],
  queryFn: () => therapistsApi.myProfile(),
  retry: false,
});

/** The server's own signal that this account has no therapist profile. */
const notATherapist = computed(
  () => loadError.value instanceof ApiError && loadError.value.status === 403,
);

const loadErrorMessage = computed(() =>
  loadError.value instanceof ApiError
    ? loadError.value.message
    : 'Check your connection and try again.',
);

const selected = ref<string[]>([]);
const customEntry = ref('');
const entryError = ref('');
const saving = ref(false);

/** Seeded once the profile arrives, and again if it is refetched from
 *  elsewhere while this screen sits open. */
watch(
  profile,
  (next) => {
    if (next) selected.value = [...next.specialties];
  },
  { immediate: true },
);

const atLimit = computed(() => selected.value.length >= MAX_SPECIALTIES);

const unusedSuggestions = computed(() =>
  SPECIALTY_SUGGESTIONS.filter(
    (s) => !selected.value.some((chosen) => chosen.toLowerCase() === s.toLowerCase()),
  ),
);

const dirty = computed(() => {
  const saved = profile.value?.specialties ?? [];
  return (
    saved.length !== selected.value.length ||
    saved.some((value, index) => value !== selected.value[index])
  );
});

function add(value: string) {
  const result = addSpecialty(selected.value, value);
  if (!result.ok) {
    entryError.value = result.error;
    return;
  }
  selected.value = result.specialties;
  entryError.value = '';
}

function remove(value: string) {
  selected.value = removeSpecialty(selected.value, value);
  entryError.value = '';
}

function addCustom() {
  const result = addSpecialty(selected.value, customEntry.value);
  if (!result.ok) {
    entryError.value = result.error;
    return;
  }
  selected.value = result.specialties;
  customEntry.value = '';
  entryError.value = '';
}

async function onSave() {
  saving.value = true;
  try {
    const updated = await therapistsApi.updateMyProfile({ specialties: selected.value });
    queryClient.setQueryData(['therapist', 'my-profile'], updated);
    // Clients browsing therapists are now looking at a stale list.
    await queryClient.invalidateQueries({ queryKey: ['therapists'] });
    await toast.show('Your profile is updated', 'success');
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'We could not save your areas of specialization. Please try again.';
    await toast.show(message, 'danger', { title: 'Could not save' });
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
  gap: 20px;
}
.cc-spec__intro {
  margin: 0;
  color: var(--cc-ink-600);
}
.cc-spec__heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  font-size: 15px;
  margin: 0 0 8px;
}
.cc-spec__count {
  font-variant-numeric: tabular-nums;
}
.cc-spec__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cc-spec__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: var(--cc-radius-pill);
  border: 1px solid var(--cc-line);
  background: var(--cc-surface-0);
  font-family: var(--cc-font-interface);
  font-size: 13px;
  font-weight: 500;
  color: var(--cc-ink-900);
  cursor: pointer;
}
.cc-spec__chip:disabled {
  color: var(--cc-ink-300);
  cursor: not-allowed;
}
.cc-spec__chip--on {
  border: 1.5px solid var(--cc-color-primary);
  background: var(--cc-color-mist);
  color: var(--cc-color-primary);
}
.cc-spec__none {
  margin: 0;
}
.cc-screen__footer {
  padding: 11px 16px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
</style>
