<template>
  <ion-page>
    <!-- PR2 is a modal: dismiss on the left, Save on the right. -->
    <div class="cc-edit__bar">
      <button type="button" class="cc-edit__close" aria-label="Close without saving" @click="close">
        <AppIcon name="close" :size="22" color="var(--cc-color-primary)" />
      </button>
      <span class="cc-text-body-strong">Edit profile</span>
      <button
        type="button"
        class="cc-edit__save"
        :disabled="saving || !canSave"
        @click="onSave"
      >
        Save
      </button>
    </div>

    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <div class="cc-edit__photo">
          <button type="button" class="cc-edit__photo-button" :disabled="savingPhoto" @click="choosePhoto">
            <AppAvatar :name="profileName" :src="auth.user?.avatarUrl ?? undefined" :size="88" />
            <span class="cc-edit__photo-badge" aria-hidden="true">
              <AppIcon name="photo_camera" :size="16" color="#fff" />
            </span>
          </button>
          <button type="button" class="cc-edit__photo-action" :disabled="savingPhoto" @click="choosePhoto">
            {{ savingPhoto ? 'Updating photo…' : 'Change photo' }}
          </button>
          <input
            ref="photoInput"
            class="cc-edit__photo-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            @change="onPhotoSelected"
          />
        </div>

        <AppImageCropper v-model="cropping" :file="pendingPhoto" @confirm="onCropConfirmed" />

        <div class="cc-edit__names">
          <AppInput v-model="firstName" label="First name" placeholder="Amara" />
          <AppInput v-model="lastName" label="Last name" placeholder="Okafor" />
        </div>

        <AppSheetSelect
          v-model="gender"
          label="Gender"
          title="Gender"
          placeholder="Select your gender"
          :options="genderSelectOptions"
          clearable
          clear-label="Remove my gender"
        />

        <AppInput
          ref="dobField"
          v-model="dateOfBirth"
          type="date"
          label="Date of birth"
          class="cc-edit__dob"
          :min="DOB_MIN"
          :max="DOB_MAX"
          :error="dobError"
          helper="You need to be at least 14 to use CruxCare."
        >
          <template #trailing>
            <!-- The WebView's own date field draws a chevron and only on some
                 builds, so its indicator is hidden and this is shown instead —
                 always visible, and always the same control. -->
            <button
              type="button"
              class="cc-edit__dob-button"
              aria-label="Open the calendar"
              @click="openDatePicker"
            >
              <AppIcon name="calendar_month" :size="20" color="var(--cc-color-primary)" />
            </button>
          </template>
        </AppInput>

        <AppSheetSelect
          v-model="language"
          label="Language"
          title="Language"
          placeholder="Select a language"
          :options="languageSelectOptions"
          clearable
          clear-label="Remove my language"
        />

        <div class="cc-edit__about">
          <label class="cc-edit__about-label" :for="aboutId">About</label>
          <textarea
            :id="aboutId"
            v-model="about"
            class="cc-edit__about-input"
            rows="4"
            :maxlength="ABOUT_MAX"
            placeholder="A short line about you. Clients see this on your profile."
          ></textarea>
          <div class="cc-edit__about-count">{{ about.length }}/{{ ABOUT_MAX }}</div>
        </div>

        <!-- Read-only: the web app writes `outlet_details`, the phone shows the
             name out of it. Hidden entirely when there is no outlet rather than
             rendered blank. -->
        <div v-if="outletName" class="cc-edit__outlet">
          <AppIcon name="storefront" :size="18" color="var(--cc-color-primary)" />
          <div>
            <div class="cc-edit__outlet-label">Your outlet</div>
            <div class="cc-text-body-strong" style="font-size: 14px">{{ outletName }}</div>
          </div>
        </div>

        <!-- PR2's closing note, verbatim. It is the whole reason the verified
             fields are not on this screen. -->
        <div class="cc-edit__note">
          <AppIcon name="lock" :size="18" color="var(--cc-ink-600)" />
          <p>Email, phone and Crux ID change under Personal information, where they need verifying.</p>
        </div>
      </div>

      <div class="cc-screen__footer">
        <AppButton :loading="saving" :disabled="!canSave" @click="onSave">Save changes</AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import {
  AppAvatar,
  AppButton,
  AppIcon,
  AppImageCropper,
  AppInput,
  AppSheetSelect,
} from '@/components/ui';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/stores/auth';
import { genderOptions, languageOptions, type Gender } from '@/types/user';
import { useToast } from '@/composables/useToast';
import { prepareAvatarUpload, type AvatarCrop } from '@/utils/avatarImage';
import { ApiError } from '@/types/api';

/**
 * PR2 · Edit profile — cosmetic fields only.
 *
 * The split from PR3 is the design's point: anything that needs verifying to
 * change (email, phone, Crux ID) lives on Personal information, and this screen
 * holds what a person can simply set.
 *
 * Date of birth and language landed with a migration; `about` had a column all
 * along and was simply never returned to the phone. Display name is drawn here
 * too and still has nothing behind it, so it is not stubbed. The outlet name
 * is shown but not editable — the web app owns that blob.
 */
const auth = useAuthStore();
const router = useRouter();
const toast = useToast();

const firstName = ref(auth.user?.firstName ?? '');
const lastName = ref(auth.user?.lastName ?? '');
/** Empty string, not null, so the placeholder option stays selected for an
 *  account that has never recorded one. It is mapped back on save. */
const gender = ref<Gender | ''>(auth.user?.gender ?? '');
/**
 * What the server had when this screen opened. Registration writes a platform
 * default, so a value arriving here is not evidence the member ever stated it —
 * and saving an unrelated field must not turn that default into their answer.
 * Only a value the member actually changed is sent.
 */
const genderOnOpen = gender.value;
const genderSelectOptions = genderOptions.map((o) => ({ value: o.value, label: o.label }));
const languageSelectOptions = languageOptions.map((o) => ({ value: o.value, label: o.label }));

const ABOUT_MAX = 1000;
const aboutId = `cc-about-${useId()}`;

const about = ref(auth.user?.about ?? '');
/** `YYYY-MM-DD`, which is both what the input reads and what the API stores. */
const dateOfBirth = ref(auth.user?.dateOfBirth ?? '');
const language = ref(auth.user?.language ?? '');

/** Read-only. The web app owns `outlet_details`; this only displays it. */
const outletName = computed(() => auth.user?.outletName ?? '');

/**
 * The bounds the calendar itself enforces.
 *
 * `max` is the most recent birthday that still makes someone 14, so every date
 * a younger person would pick is greyed out in the picker rather than accepted
 * and then rejected. `min` keeps the year wheel to a sane span.
 */
const MINIMUM_AGE = 14;
const OLDEST_YEARS = 120;

function isoYearsAgo(years: number): string {
  const at = new Date();
  at.setFullYear(at.getFullYear() - years);
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

const DOB_MAX = isoYearsAgo(MINIMUM_AGE);
const DOB_MIN = isoYearsAgo(OLDEST_YEARS);

const dobField = ref<{ inputElement: HTMLInputElement | null } | null>(null);

/**
 * Opens the platform picker.
 *
 * `showPicker()` is the only reliable way to raise it from a button; where the
 * WebView is too old for it, focusing the field is what the member would have
 * done anyway.
 */
function openDatePicker() {
  const input = dobField.value?.inputElement;
  if (!input) return;


  try {
    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }
  } catch {
    // Some builds throw rather than no-op when the field is not user-activated.
  }

  input.focus();
  input.click();
}

/** Mirrors the server's rule so a typo is caught before the round trip. */
const dobError = computed(() => {
  if (!dateOfBirth.value) return '';
  const at = new Date(`${dateOfBirth.value}T00:00:00`);
  if (Number.isNaN(at.getTime())) return 'That date does not look right.';
  // Compared as ISO strings, which sort correctly and avoid a timezone shifting
  // a birthday across the boundary.
  if (dateOfBirth.value > DOB_MAX) return `You need to be at least ${MINIMUM_AGE} to use CruxCare.`;
  if (dateOfBirth.value < DOB_MIN) return 'That date of birth does not look right.';
  return '';
});

const saving = ref(false);
const savingPhoto = ref(false);
const photoInput = ref<HTMLInputElement | null>(null);
const pendingPhoto = ref<File | null>(null);
const cropping = ref(false);
const profileName = computed(() => `${auth.user?.firstName ?? ''} ${auth.user?.lastName ?? ''}`.trim());

/** Save stays inert until something has actually changed, so the button does
 *  not invite a write that would be a no-op. */
const dirty = computed(
  () =>
    firstName.value !== (auth.user?.firstName ?? '') ||
    lastName.value !== (auth.user?.lastName ?? '') ||
    gender.value !== genderOnOpen ||
    about.value !== (auth.user?.about ?? '') ||
    dateOfBirth.value !== (auth.user?.dateOfBirth ?? '') ||
    language.value !== (auth.user?.language ?? ''),
);

const canSave = computed(() => dirty.value && !dobError.value);

function close() {
  router.back();
}

function choosePhoto() {
  photoInput.value?.click();
}

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

async function onPhotoSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    input.value = '';
    await toast.show('Choose a JPG, PNG, or WebP image.', 'warning', { title: 'Unsupported photo format' });
    return;
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    input.value = '';
    await toast.show('Choose an image smaller than 5 MB.', 'warning', { title: 'Photo is too large' });
    return;
  }

  // Hand off to the cropper; the upload waits for the member to frame the shot.
  pendingPhoto.value = file;
  cropping.value = true;
  input.value = '';
}

// Dismissing the cropper drops the selection, releasing its object URL.
watch(cropping, (open) => {
  if (!open && !savingPhoto.value) pendingPhoto.value = null;
});

async function onCropConfirmed(crop: AvatarCrop) {
  const file = pendingPhoto.value;
  if (!file) return;

  savingPhoto.value = true;
  try {
    const upload = await prepareAvatarUpload(file, crop);
    const updated = await authApi.updateAvatar(upload);
    auth.user = updated;
    await toast.show('Profile photo updated', 'success');
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error
        : 'We could not update your profile photo. Please try again.';
    await toast.show(message, 'danger', { title: 'Could not update photo' });
  } finally {
    savingPhoto.value = false;
    pendingPhoto.value = null;
  }
}

async function onSave() {
  if (!canSave.value) return;

  saving.value = true;
  try {
    const updated = await authApi.updateMe({
      firstName: firstName.value,
      lastName: lastName.value,
      ...(gender.value === genderOnOpen
        ? {}
        : { gender: gender.value === '' ? null : gender.value }),
      // Blank is sent as null, which is how the API clears a field. Sending ''
      // would store a value that renders as nothing but is not absent.
      about: about.value.trim() || null,
      dateOfBirth: dateOfBirth.value || null,
      language: language.value || null,
    });
    auth.user = updated;
    await toast.show('Saved', 'success');
    router.back();
  } catch (error) {
    // Without this a rejected save left the screen sitting there with no word
    // either way, and the member believing it had gone through.
    const message =
      error instanceof ApiError ? error : 'We could not save your changes. Please try again.';
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
.cc-edit__bar {
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  align-items: center;
  gap: 8px;
  padding: calc(10px + var(--ion-safe-area-top, 0px)) 10px 10px;
  background: var(--cc-surface-app);
}
.cc-edit__bar > span {
  text-align: center;
  font-size: 15px;
}
.cc-edit__close {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: none;
  background: none;
  cursor: pointer;
}
.cc-edit__save {
  min-width: 44px;
  min-height: 44px;
  border: none;
  background: none;
  color: var(--cc-color-primary);
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
.cc-edit__save:disabled {
  color: var(--cc-ink-400);
  cursor: default;
}
.cc-edit__photo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 4px 0 6px;
}
.cc-edit__photo-button {
  position: relative;
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
  border-radius: 999px;
}
.cc-edit__photo-button:focus-visible {
  outline: 3px solid rgba(14, 124, 107, 0.35);
  outline-offset: 3px;
}
.cc-edit__photo-badge {
  position: absolute;
  right: 2px;
  bottom: 2px;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: var(--cc-color-primary);
  border: 2px solid var(--cc-surface-app);
}
.cc-edit__photo-action {
  border: none;
  background: none;
  color: var(--cc-color-primary);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  min-height: 44px;
}
.cc-edit__photo-input {
  display: none;
}
.cc-edit__names {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
/* The WebView draws its own indicator on a date field — sometimes a chevron,
   sometimes nothing. Hidden so there is one calendar control, not two. */
.cc-edit__dob :deep(input[type='date'])::-webkit-calendar-picker-indicator {
  display: none;
  -webkit-appearance: none;
}
.cc-edit__dob :deep(input[type='date']) {
  -webkit-appearance: none;
  appearance: none;
}
.cc-edit__dob-button {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin: -10px -6px -10px 0;
  border: none;
  background: none;
  cursor: pointer;
}
.cc-edit__dob-button:focus-visible {
  outline: 3px solid rgba(14, 124, 107, 0.35);
  outline-offset: -3px;
  border-radius: 8px;
}
.cc-edit__about {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cc-edit__about-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--cc-ink-700);
}
.cc-edit__about-input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid var(--cc-line);
  border-radius: 10px;
  background: var(--cc-surface-0);
  color: var(--cc-ink-900);
  font: inherit;
  font-size: 14.5px;
  line-height: 1.5;
  resize: vertical;
}
.cc-edit__about-input:focus-visible {
  outline: 3px solid rgba(14, 124, 107, 0.35);
  outline-offset: 1px;
  border-color: var(--cc-color-primary);
}
.cc-edit__about-count {
  align-self: flex-end;
  font-size: 12px;
  color: var(--cc-ink-400);
  font-variant-numeric: tabular-nums;
}
.cc-edit__outlet {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-lg);
  background: var(--cc-surface-0);
}
.cc-edit__outlet-label {
  font-size: 12px;
  color: var(--cc-ink-400);
}
.cc-edit__note {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 14px;
  border-radius: var(--cc-radius-lg);
  background: var(--cc-surface-0);
  border: 1px solid var(--cc-line);
}
.cc-edit__note p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cc-ink-600);
}
</style>
