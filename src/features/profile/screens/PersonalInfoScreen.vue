<template>
  <ion-page>
    <AppHeader title="Personal information" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
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
import { ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { AppButton, AppHeader, AppIcon, AppInput } from '@/components/ui';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

/** PR3 · Personal information — verified fields shown read-only in place;
 * cosmetic fields (name) editable directly. */
const auth = useAuthStore();
const toast = useToast();
const firstName = ref(auth.user?.firstName ?? '');
const lastName = ref(auth.user?.lastName ?? '');
const saving = ref(false);

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
.cc-screen__footer {
  padding: 11px 16px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
</style>
