<template>
  <ion-page>
    <ion-header class="cc-plain-header">
      <ion-toolbar class="cc-plain-header__bar">
        <ion-buttons slot="start"><ion-back-button default-href="/auth/login" text="" /></ion-buttons>
        <ion-title>New password</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <h2 class="cc-text-h1" style="margin: 0 0 6px">Set a new password</h2>
        <p class="cc-text-body" style="margin: 0 0 18px; font-size: 13px">
          Choose something you haven't used on CruxCare before.
        </p>

        <AppInput v-model="password" label="New password" :type="show ? 'text' : 'password'">
          <template #trailing>
            <button type="button" class="cc-toggle-visibility" @click="show = !show">
              <AppIcon :name="show ? 'visibility' : 'visibility_off'" :size="20" color="var(--cc-ink-400)" />
            </button>
          </template>
        </AppInput>
        <div class="cc-strength">
          <span v-for="i in 4" :key="i" class="cc-strength__bar" :class="{ 'cc-strength__bar--filled': i <= strength.score }" />
        </div>

        <AppInput v-model="confirm" label="Confirm new password" :type="show ? 'text' : 'password'" />

        <AppCard>
          <div class="cc-text-body-strong" style="font-size: 13px; margin-bottom: 9px">Requirements</div>
          <div v-for="r in requirements" :key="r.label" class="cc-req">
            <AppIcon :name="r.met ? 'check' : 'radio_button_unchecked'" :size="18" :color="r.met ? 'var(--cc-color-success)' : 'var(--cc-ink-300)'" />
            <span class="cc-text-body" style="font-size: 12px">{{ r.label }}</span>
          </div>
        </AppCard>

        <label class="cc-signout">
          <input v-model="signOutOthers" type="checkbox" />
          <span class="cc-text-body" style="font-size: 12px">Sign out of all other devices now</span>
        </label>
      </div>
      <div class="cc-screen__footer">
        <AppButton :disabled="!canSubmit" :loading="submitting" @click="onSubmit">Save password</AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppButton, AppCard, AppIcon, AppInput } from '@/components/ui';
import { authApi } from '@/api/auth.api';
import { passwordStrength } from '../schemas/register.schema';

const route = useRoute();
const router = useRouter();
const identifier = route.query.identifier as string;
const code = route.query.code as string;

const password = ref('');
const confirm = ref('');
const show = ref(false);
const signOutOthers = ref(true);
const submitting = ref(false);

const strength = computed(() => passwordStrength(password.value));
const requirements = computed(() => [
  { label: 'At least 8 characters', met: password.value.length >= 8 },
  { label: 'One number or symbol', met: /[\d\W]/.test(password.value) },
  { label: 'Passwords match', met: !!password.value && password.value === confirm.value },
]);
const canSubmit = computed(() => requirements.value.every((r) => r.met));

async function onSubmit() {
  submitting.value = true;
  try {
    await authApi.resetPassword(identifier, code, password.value, signOutOthers.value);
    router.replace({ name: 'reset-success' });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.cc-plain-header {
  box-shadow: none;
}
.cc-plain-header__bar {
  --background: var(--cc-surface-0);
  --border-width: 0;
}
.cc-screen {
  --background: var(--cc-surface-0);
}
.cc-screen__pad {
  padding: 8px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-toggle-visibility {
  background: none;
  border: none;
  display: flex;
  cursor: pointer;
}
.cc-strength {
  display: flex;
  gap: 4px;
  margin-top: -4px;
}
.cc-strength__bar {
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: var(--cc-divider);
}
.cc-strength__bar--filled {
  background: var(--cc-color-success);
}
.cc-req {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}
.cc-signout {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  cursor: pointer;
}
.cc-screen__footer {
  padding: 11px 16px calc(25px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
</style>
