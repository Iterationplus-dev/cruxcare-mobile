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
        :disabled="saving || !dirty"
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

        <!-- PR2's closing note, verbatim. It is the whole reason the verified
             fields are not on this screen. -->
        <div class="cc-edit__note">
          <AppIcon name="lock" :size="18" color="var(--cc-ink-600)" />
          <p>Email, phone and Crux ID change under Personal information, where they need verifying.</p>
        </div>
      </div>

      <div class="cc-screen__footer">
        <AppButton :loading="saving" :disabled="!dirty" @click="onSave">Save changes</AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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
import { genderOptions, type Gender } from '@/types/user';
import { useToast } from '@/composables/useToast';
import { prepareAvatarUpload, type AvatarCrop } from '@/utils/avatarImage';
import { ApiError } from '@/types/api';

/**
 * PR2 · Edit profile — cosmetic fields only.
 *
 * The split from PR3 is the design's point: anything that needs verifying to
 * change (email, phone, Crux ID) lives on Personal information, and this screen
 * holds what a person can simply set. Display name, date of birth and language
 * are drawn here too but the API carries none of them, so they are not stubbed.
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
    gender.value !== genderOnOpen,
);

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
        ? error.message
        : 'We could not update your profile photo. Please try again.';
    await toast.show(message, 'danger', { title: 'Could not update photo' });
  } finally {
    savingPhoto.value = false;
    pendingPhoto.value = null;
  }
}

async function onSave() {
  if (!dirty.value) return;

  saving.value = true;
  try {
    const updated = await authApi.updateMe({
      firstName: firstName.value,
      lastName: lastName.value,
      ...(gender.value === genderOnOpen
        ? {}
        : { gender: gender.value === '' ? null : gender.value }),
    });
    auth.user = updated;
    await toast.show('Saved', 'success');
    router.back();
  } catch (error) {
    // Without this a rejected save left the screen sitting there with no word
    // either way, and the member believing it had gone through.
    const message =
      error instanceof ApiError ? error.message : 'We could not save your changes. Please try again.';
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
