<template>
  <ion-page>
    <AppHeader title="Account recovery" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <h2 class="cc-text-h1" style="margin: 0 0 6px">Recover without your phone</h2>
        <p class="cc-text-body" style="margin: 0 0 16px; font-size: 12px">
          A person reviews this. Wallet, savings and commitment balances stay frozen while the case is open.
        </p>

        <AppInput v-model="registeredName" label="Crux ID or registered name" />
        <AppInput v-model="contact" label="A contact we can reply to" autocomplete="email" />
        <div class="cc-field">
          <label class="cc-field__label">What happened</label>
          <textarea v-model="description" class="cc-textarea" rows="3" placeholder="Briefly describe what happened" />
        </div>

        <div class="cc-notice">
          <AppIcon name="schedule" :size="20" color="#9A5B15" />
          <p>Cases close in 2 to 5 working days. You get a case number as soon as you submit.</p>
        </div>
      </div>
      <div class="cc-screen__footer">
        <AppButton :disabled="!canSubmit" :loading="submitting" @click="onSubmit">Submit recovery request</AppButton>
      </div>
    </ion-content>

    <AppSheet v-model="submitted" title="Request received">
      <p class="cc-text-body" style="margin: 0 0 16px">
        Your case number is <span class="cc-text-mono">{{ caseNumber }}</span>. We'll reply at {{ contact }}.
      </p>
      <AppButton @click="router.replace({ name: 'welcome' })">Back to welcome</AppButton>
    </AppSheet>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppButton, AppHeader, AppIcon, AppInput, AppSheet } from '@/components/ui';
import { authApi } from '@/api/auth.api';

const router = useRouter();
const registeredName = ref('');
const contact = ref('');
const description = ref('');
const submitting = ref(false);
const submitted = ref(false);
const caseNumber = ref('');

const canSubmit = computed(() => !!registeredName.value && !!contact.value);

async function onSubmit() {
  submitting.value = true;
  try {
    const result = await authApi.submitAssistedRecovery({
      identifier: registeredName.value,
      contact: contact.value,
      description: description.value,
    });
    caseNumber.value = result.caseNumber;
    submitted.value = true;
  } finally {
    submitting.value = false;
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
.cc-field__label {
  display: block;
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 4px;
}
.cc-textarea {
  width: 100%;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-sm);
  padding: 9px 12px;
  font-family: var(--cc-font-interface);
  font-size: 13px;
  box-sizing: border-box;
  resize: vertical;
}
.cc-notice {
  display: flex;
  gap: 10px;
  padding: 13px 14px;
  border-radius: 14px;
  background: #fff6ea;
  border: 1px solid #f0dcc0;
}
.cc-notice p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 12px;
  line-height: 18px;
  color: var(--cc-ink-600);
}
.cc-screen__footer {
  padding: 11px 16px calc(25px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
</style>
