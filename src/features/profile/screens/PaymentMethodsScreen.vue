<template>
  <ion-page>
    <AppHeader title="Payment methods" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <EmptyState
          v-if="!methods.length"
          icon="credit_card"
          title="No cards saved"
          message="Add a card for faster checkout. Card numbers never touch CruxCare's servers."
          primary-action="Add a card"
          @primary="onAdd"
        />
        <template v-else>
          <AppCard v-for="m in methods" :key="m.label" class="cc-pm">
            <AppIcon name="credit_card" :size="22" :color="m.expired ? 'var(--cc-color-warning)' : 'var(--cc-ink-600)'" />
            <div class="cc-pm__body">
              <div class="cc-text-body-strong" style="font-size: 14px">{{ m.label }}</div>
              <div v-if="m.expired" class="cc-text-caption" style="color: var(--cc-color-warning-text)">Expired</div>
            </div>
          </AppCard>
          <AppButton variant="secondary" @click="onAdd">Add another card</AppButton>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { AppButton, AppCard, AppHeader, AppIcon } from '@/components/ui';
import { EmptyState } from '@/components/state';
import { paymentProvider } from '@/services/payment/PaymentProvider';

/** PR6 · Payment methods — expired-card state inline, provider left open (README open item). */
const methods = ref<{ label: string; expired: boolean }[]>([]);

async function onAdd() {
  const { label } = await paymentProvider.collectPaymentMethod();
  methods.value.push({ label, expired: false });
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
.cc-pm {
  display: flex;
  gap: 12px;
  align-items: center;
}
.cc-pm__body {
  flex: 1;
}
</style>
