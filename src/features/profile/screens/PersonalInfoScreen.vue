<template>
  <ion-page>
    <AppHeader title="Personal information" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <section class="cc-profile-photo" :class="{ 'cc-profile-photo--focus': route.query.focus === 'profile-photo' }">
          <AppAvatar :name="profileName" :src="auth.user?.avatarUrl ?? undefined" :size="60" />
          <div class="cc-profile-photo__copy">
            <div class="cc-text-body-strong" style="font-size: 14.5px">Profile photo</div>
            <p>Help clients recognise you before their first session.</p>
            <button type="button" class="cc-profile-photo__action" :disabled="savingPhoto" @click="choosePhoto">
              {{ savingPhoto ? 'Updating photo...' : auth.user?.avatarUrl ? 'Change photo' : 'Add photo' }}
            </button>
          </div>
          <input ref="photoInput" class="cc-profile-photo__input" type="file" accept="image/*" @change="onPhotoSelected" />
        </section>
        <AppInput v-model="firstName" label="First name" placeholder="Amara" />
        <AppInput v-model="lastName" label="Last name" placeholder="Okafor" />
        <AppInput :model-value="auth.user?.email" label="Email" disabled helper="Verified · contact support to change" />
        <AppInput :model-value="auth.user?.phone" label="Phone" disabled helper="Verified · contact support to change" />
        <AppInput v-if="auth.user?.membership" :model-value="auth.user.membership.cruxId" label="Crux ID" disabled />

        <div class="cc-export">
          <AppIcon name="download" :size="20" color="var(--cc-color-primary)" />
          <div class="cc-export__body">
            <div class="cc-text-body-strong" style="font-size: 13.5px">Export your data</div>
            <div class="cc-text-caption">Data sits with the field it describes, so it's requested from here.</div>
          </div>
        </div>
      </div>
      <div class="cc-screen__footer">
        <AppButton :loading="saving" @click="onSave">Save changes</AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute } from 'vue-router';
import { AppAvatar, AppButton, AppHeader, AppIcon, AppInput } from '@/components/ui';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

/** PR3 · Personal information — verified fields shown read-only in place;
 * cosmetic fields (name) editable directly. */
const auth = useAuthStore();
const toast = useToast();
const route = useRoute();
const firstName = ref(auth.user?.firstName ?? '');
const lastName = ref(auth.user?.lastName ?? '');
const saving = ref(false);
const savingPhoto = ref(false);
const photoInput = ref<HTMLInputElement | null>(null);
const profileName = computed(() => `${auth.user?.firstName ?? ''} ${auth.user?.lastName ?? ''}`.trim());

function choosePhoto() {
  photoInput.value?.click();
}

async function onPhotoSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  savingPhoto.value = true;
  try {
    const avatarUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read photo'));
      reader.readAsDataURL(file);
    });
    const updated = await authApi.updateMe({ avatarUrl });
    auth.user = updated;
    await toast.show('Profile photo updated', 'success');
  } finally {
    savingPhoto.value = false;
    input.value = '';
  }
}

async function onSave() {
  saving.value = true;
  try {
    const updated = await authApi.updateMe({ firstName: firstName.value, lastName: lastName.value });
    auth.user = updated;
    await toast.show('Saved', 'success');
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
  gap: 10px;
}
.cc-export {
  display: flex;
  gap: 10px;
  padding: 14px;
  border-radius: var(--cc-radius-lg);
  background: var(--cc-color-mist);
  margin-top: 8px;
}
.cc-export__body {
  flex: 1;
}
.cc-profile-photo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-lg);
  background: var(--cc-surface-0);
}
.cc-profile-photo--focus {
  border-color: var(--cc-color-primary);
  box-shadow: 0 0 0 3px rgba(14, 124, 107, 0.1);
}
.cc-profile-photo__copy {
  flex: 1;
  min-width: 0;
}
.cc-profile-photo__copy p {
  margin: 2px 0 7px;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 16px;
}
.cc-profile-photo__action {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--cc-color-primary);
  font-family: var(--cc-font-interface);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.cc-profile-photo__action:disabled {
  color: var(--cc-ink-400);
  cursor: wait;
}
.cc-profile-photo__input {
  display: none;
}
.cc-screen__footer {
  padding: 11px 16px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
</style>
