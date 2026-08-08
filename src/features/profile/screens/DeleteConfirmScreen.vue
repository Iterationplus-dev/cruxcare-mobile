<template>
  <ion-page>
    <ion-content class="cc-screen">
      <div class="cc-sheet-look">
        <div class="cc-grabber" />
        <div class="cc-title-row">
          <AppIcon name="warning" :size="26" color="var(--cc-error-surface-text)" />
          <h3 class="cc-text-h1" style="margin: 0">Delete this account?</h3>
        </div>
        <p class="cc-text-body" style="margin: 0 0 14px">
          You have 30 days to log in and cancel. After {{ deadlineLabel }} this cannot be undone by anyone,
          including support.
        </p>
        <div class="cc-what-deletes">
          <div class="cc-text-body-strong" style="font-size: 12px; color: var(--cc-error-surface-text)">
            What is deleted permanently
          </div>
          <div class="cc-text-body" style="font-size: 12px">
            Health profile and session notes · chat history · Crux ID link and network position
          </div>
        </div>
        <AppInput v-model="typed" label="Type DELETE to confirm" placeholder="DELETE" :invalid="!!error" />
        <AppInput v-model="password" label="Password" type="password" :error="error" />
        <AppButton
          variant="secondary"
          :disabled="typed !== 'DELETE' || !password"
          :loading="submitting"
          style="margin: 16px 0 9px; border-color: #c0392b; background: #c0392b; color: #fff"
          @click="onConfirm"
        >
          Delete my account
        </AppButton>
        <AppButton variant="text" @click="router.back()">Cancel</AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppButton, AppIcon, AppInput } from '@/components/ui';
import { authApi } from '@/api/auth.api';
import { ApiError } from '@/types/api';

const router = useRouter();
const typed = ref('');
const password = ref('');
const submitting = ref(false);
const error = ref('');

const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
const deadlineLabel = deadline.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

async function onConfirm() {
  submitting.value = true;
  error.value = '';
  try {
    const { deletionCompletesAt } = await authApi.deleteAccount(password.value);
    router.replace({ name: 'account-deleted', query: { completesAt: deletionCompletesAt } });
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Something went wrong.';
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.cc-screen {
  --background: rgba(26, 43, 34, 0.45);
}
.cc-sheet-look {
  margin-top: auto;
  background: var(--cc-surface-0);
  border-radius: 26px 26px 0 0;
  padding: 20px 18px calc(26px + env(safe-area-inset-bottom));
  min-height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: flex-end;
}
.cc-grabber {
  width: 44px;
  height: 4px;
  border-radius: 999px;
  background: var(--cc-line);
  margin: 0 auto;
}
.cc-title-row {
  display: flex;
  gap: 11px;
  align-items: center;
}
.cc-what-deletes {
  background: var(--cc-error-surface);
  border: 1px solid var(--cc-error-surface-border);
  border-radius: 14px;
  padding: 13px 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
</style>
