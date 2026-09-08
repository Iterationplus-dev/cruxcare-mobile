<template>
  <ion-page>
    <AppHeader title="Delivery address" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <p class="cc-address__intro">
          Where orders are delivered. It is also what puts you near a therapist when you search by
          distance.
        </p>

        <AppInput
          v-model="street"
          label="Street"
          placeholder="7 Ogunlana Drive"
          autocomplete="address-line1"
        />
        <AppInput v-model="town" label="Town or area" placeholder="Surulere" />

        <!-- Country first, then state, then city: each list is fetched from the
             one above it, which is why they are ordered this way rather than
             alphabetically down the form. -->
        <AppSheetSelect
          v-model="countryId"
          label="Country"
          title="Country"
          placeholder="Select a country"
          :options="countryOptions"
        />
        <AppSheetSelect
          v-model="stateId"
          label="State"
          :title="stateTitle"
          :placeholder="statePlaceholder"
          :options="stateOptions"
        />
        <AppSheetSelect
          v-model="cityId"
          label="City"
          :title="cityTitle"
          :placeholder="cityPlaceholder"
          :options="cityOptions"
        />

        <p v-if="coverageGap" class="cc-text-caption">
          We do not have that list on file yet. Saving the country alone is fine — you can add the
          rest once it is there.
        </p>
      </div>

      <div class="cc-screen__footer">
        <AppButton :loading="saving" :disabled="!dirty" @click="onSave">Save address</AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppButton, AppHeader, AppInput, AppSheetSelect } from '@/components/ui';
import { useCities, useCountries, useStates } from '@/composables/useLocations';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';

/**
 * PR3's Delivery address row led to a chevron and nothing else. The API has
 * accepted an address on `PATCH /me` all along; there was simply no screen.
 *
 * The API stores names, not ids — the therapist directory composes its location
 * string from them — so the selected ids are resolved back to labels on save,
 * exactly as registration does.
 */
const auth = useAuthStore();
const router = useRouter();
const toast = useToast();

const saved = computed(() => auth.user?.address ?? null);

const street = ref(saved.value?.street ?? '');
const town = ref(saved.value?.town ?? '');
const countryId = ref('');
const stateId = ref('');
const cityId = ref('');

const { data: countries } = useCountries();
const countryOptions = computed(() =>
  (countries.value ?? []).map((c) => ({ value: c.id, label: c.name })),
);

const selectedCountryId = computed(() => countryId.value || null);
const { data: states } = useStates(selectedCountryId);
const stateOptions = computed(() =>
  (states.value ?? []).map((s) => ({ value: s.id, label: s.name })),
);

const selectedStateId = computed(() => stateId.value || null);
const { data: cities } = useCities(selectedStateId);
const cityOptions = computed(() =>
  (cities.value ?? []).map((c) => ({ value: c.id, label: c.name })),
);

/**
 * Seeded from the stored names once the lists arrive, so someone returning to
 * this screen sees what they saved rather than three empty selects.
 */
watch(
  [countries, () => saved.value?.country],
  () => {
    if (countryId.value || !saved.value?.country) return;
    const match = (countries.value ?? []).find(
      (c) => c.name.toLowerCase() === saved.value?.country?.toLowerCase(),
    );
    if (match) countryId.value = match.id;
  },
  { immediate: true },
);

watch([states, () => saved.value?.state], () => {
  if (stateId.value || !saved.value?.state) return;
  const match = (states.value ?? []).find(
    (s) => s.name.toLowerCase() === saved.value?.state?.toLowerCase(),
  );
  if (match) stateId.value = match.id;
});

watch([cities, () => saved.value?.city], () => {
  if (cityId.value || !saved.value?.city) return;
  const match = (cities.value ?? []).find(
    (c) => c.name.toLowerCase() === saved.value?.city?.toLowerCase(),
  );
  if (match) cityId.value = match.id;
});

/** A choice above invalidates everything under it — a city in the old state is
 *  not a city in the new one. */
watch(countryId, (next, previous) => {
  if (previous === undefined || next === previous) return;
  stateId.value = '';
  cityId.value = '';
});
watch(stateId, (next, previous) => {
  if (previous === undefined || next === previous) return;
  cityId.value = '';
});

const stateTitle = computed(() => (countryId.value ? 'State' : 'Choose a country first'));
const statePlaceholder = computed(() =>
  !countryId.value ? 'Choose a country first' : stateOptions.value.length ? 'Select a state' : 'None on file',
);
const cityTitle = computed(() => (stateId.value ? 'City' : 'Choose a state first'));
const cityPlaceholder = computed(() =>
  !stateId.value ? 'Choose a state first' : cityOptions.value.length ? 'Select a city' : 'None on file',
);

/** Coverage is partial by design, so an empty list is a normal answer rather
 *  than a failure — but it is worth saying so instead of showing a dead select. */
const coverageGap = computed(
  () =>
    (!!countryId.value && stateOptions.value.length === 0) ||
    (!!stateId.value && cityOptions.value.length === 0),
);

function labelFor(options: { value: string; label: string }[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? '';
}

const nextAddress = computed(() => ({
  street: street.value.trim() || null,
  town: town.value.trim() || null,
  country: labelFor(countryOptions.value, countryId.value) || saved.value?.country || null,
  state: labelFor(stateOptions.value, stateId.value) || null,
  city: labelFor(cityOptions.value, cityId.value) || null,
}));

const dirty = computed(() => {
  const was = saved.value;
  const next = nextAddress.value;
  return (
    (was?.street ?? null) !== next.street ||
    (was?.town ?? null) !== next.town ||
    (was?.country ?? null) !== next.country ||
    (was?.state ?? null) !== next.state ||
    (was?.city ?? null) !== next.city
  );
});

const saving = ref(false);

async function onSave() {
  if (!dirty.value) return;

  saving.value = true;
  try {
    auth.user = await authApi.updateMe({ address: nextAddress.value });
    await toast.show('Your delivery address is saved', 'success');
    router.back();
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error
        : 'We could not save your address. Check your connection and try again.';
    await toast.show(message, 'danger', { title: 'Not saved' });
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
.cc-screen__footer {
  position: sticky;
  bottom: 0;
  padding: 12px 16px calc(12px + var(--ion-safe-area-bottom, 0px));
  background: var(--cc-surface-app);
  border-top: 1px solid var(--cc-line);
}
.cc-address__intro {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--cc-ink-600);
}
</style>
