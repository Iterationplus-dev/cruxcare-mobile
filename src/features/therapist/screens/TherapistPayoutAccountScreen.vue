<template>
  <ion-page>
    <AppHeader title="Payout account" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <div class="cc-payout__intro">
          <div class="cc-payout__intro-icon">
            <AppIcon name="payments" :size="24" color="var(--cc-color-primary)" />
          </div>
          <div>
            <h2>Where should we send your earnings?</h2>
            <p>These details are used only for therapist payouts.</p>
          </div>
        </div>

        <AppCard v-if="auth.user?.payoutAccount" class="cc-payout__confirmed">
          <AppIcon name="check_circle" :size="22" color="var(--cc-color-success)" />
          <div>
            <strong>Payout account confirmed</strong>
            <span>{{ auth.user.payoutAccount.institution }} · •••• {{ accountSuffix }}</span>
          </div>
        </AppCard>

        <AppInput v-model="accountHolder" label="Account holder name" placeholder="Name on the account" autocomplete="name" />
        <div class="cc-payout__field">
          <span class="cc-payout__field-label">Bank or payout provider</span>
          <button type="button" class="cc-payout__provider" @click="providerSheetOpen = true">
            <span :class="{ 'cc-payout__provider--placeholder': !institution }">
              {{ institution || 'Choose a provider' }}
            </span>
            <AppIcon name="expand_more" :size="20" color="var(--cc-ink-400)" />
          </button>
        </div>
        <AppInput
          v-model="accountNumber"
          label="Account number"
          placeholder="Enter account number"
          inputmode="numeric"
          autocomplete="off"
          helper="We’ll confirm this before your first payout."
        />
      </div>
      <div class="cc-screen__footer">
        <AppButton :disabled="!canSave" :loading="saving" @click="onSave">
          {{ auth.user?.payoutAccount ? 'Update payout account' : 'Confirm payout account' }}
        </AppButton>
      </div>
    </ion-content>

    <AppSheet v-model="providerSheetOpen" title="Bank or payout provider">
      <p class="cc-payout__sheet-copy">Choose the account provider that will receive your therapist payouts.</p>
      <div class="cc-payout__providers">
        <button
          v-for="provider in institutions"
          :key="provider.value"
          type="button"
          class="cc-payout__provider-option"
          :class="{ 'cc-payout__provider-option--selected': institution === provider.value }"
          @click="selectProvider(provider.value)"
        >
          <span>{{ provider.label }}</span>
          <AppIcon v-if="institution === provider.value" name="check_circle" :size="20" color="var(--cc-color-primary)" />
        </button>
      </div>
    </AppSheet>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { AppButton, AppCard, AppHeader, AppIcon, AppInput, AppSheet } from '@/components/ui';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

const auth = useAuthStore();
const toast = useToast();
const accountHolder = ref(auth.user?.payoutAccount?.accountHolder ?? '');
const institution = ref(auth.user?.payoutAccount?.institution ?? '');
const accountNumber = ref(auth.user?.payoutAccount?.accountNumber ?? '');
const saving = ref(false);
const providerSheetOpen = ref(false);

const institutions = [
  { value: 'Access Bank', label: 'Access Bank' },
  { value: 'GTCO', label: 'GTCO' },
  { value: 'Kuda', label: 'Kuda' },
  { value: 'Moniepoint', label: 'Moniepoint' },
  { value: 'OPay', label: 'OPay' },
  { value: 'Other', label: 'Other bank or provider' },
];

const accountSuffix = computed(() => auth.user?.payoutAccount?.accountNumber.slice(-4) ?? '');
const canSave = computed(
  () => accountHolder.value.trim().length > 1 && institution.value && accountNumber.value.replace(/\s/g, '').length >= 8,
);

function selectProvider(value: string) {
  institution.value = value;
  providerSheetOpen.value = false;
}

async function onSave() {
  if (!canSave.value) return;
  saving.value = true;
  try {
    const updated = await authApi.updateMe({
      payoutAccount: {
        accountHolder: accountHolder.value.trim(),
        institution: institution.value,
        accountNumber: accountNumber.value.replace(/\s/g, ''),
      },
    });
    auth.user = updated;
    await toast.show('Payout account confirmed', 'success');
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
  gap: 12px;
}
.cc-payout__intro {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}
.cc-payout__intro-icon {
  width: 46px;
  height: 46px;
  display: grid;
  flex: none;
  place-items: center;
  border-radius: 14px;
  background: var(--cc-color-mist);
}
.cc-payout__intro h2 {
  margin: 0 0 3px;
  color: var(--cc-ink-900);
  font-family: var(--cc-font-interface);
  font-size: 16px;
  line-height: 22px;
}
.cc-payout__intro p {
  margin: 0;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 12px;
  line-height: 17px;
}
.cc-payout__confirmed {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 13px;
  background: var(--cc-color-mist);
}
.cc-payout__confirmed > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cc-payout__confirmed strong {
  color: var(--cc-ink-900);
  font-family: var(--cc-font-interface);
  font-size: 13px;
}
/* Scoped to the copy block — a bare `span` here also matches the icon root. */
.cc-payout__confirmed > div > span {
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
}
.cc-payout__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cc-payout__field-label {
  color: var(--cc-ink-900);
  font-family: var(--cc-font-interface);
  font-size: 13.5px;
  font-weight: 600;
  line-height: 20px;
}
.cc-payout__provider {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: var(--cc-input-height);
  padding: 0 12px;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-sm);
  background: var(--cc-surface-0);
  color: var(--cc-ink-900);
  font-family: var(--cc-font-interface);
  font-size: 14.5px;
  text-align: left;
  cursor: pointer;
}
.cc-payout__provider--placeholder {
  color: var(--cc-ink-400);
}
.cc-payout__sheet-copy {
  margin: 0 0 14px;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 12px;
  line-height: 18px;
}
.cc-payout__providers {
  overflow: hidden;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-lg);
}
.cc-payout__provider-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 50px;
  padding: 0 14px;
  border: none;
  border-bottom: 1px solid var(--cc-divider);
  background: var(--cc-surface-0);
  color: var(--cc-ink-900);
  font-family: var(--cc-font-interface);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.cc-payout__provider-option:last-child {
  border-bottom: none;
}
.cc-payout__provider-option--selected {
  background: var(--cc-color-mist);
}
.cc-screen__footer {
  padding: 11px 16px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
</style>
