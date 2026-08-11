<template>
  <ion-page>
    <AppHeader title="Delete account" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <h2 class="cc-text-h1" style="margin: 0 0 6px">Before you delete</h2>
        <p class="cc-text-body" style="margin: 0 0 16px; font-size: 12.5px">
          Settle what's outstanding first. Deleting is permanent after 30 days.
        </p>

        <AppCard style="padding: 0">
          <AppListRow
            v-if="wallet && wallet.available > 0"
            title="Wallet balance"
            icon="account_balance_wallet"
            icon-color="var(--cc-error-surface-text)"
          >
            <template #trailing>
              <MoneyAmount :value="wallet.available" :currency="wallet.currency" size="mono" />
            </template>
          </AppListRow>
          <AppListRow
            v-for="a in upcoming"
            :key="a.id"
            title="Upcoming session"
            :subtitle="`${formatSlot(a.slot)} · will be cancelled`"
            icon="event_busy"
            icon-color="var(--cc-color-warning)"
            :divider="false"
          />
        </AppCard>

        <div class="cc-text-body-strong" style="font-size: 13.5px">Why are you leaving? (optional)</div>
        <div class="cc-reasons">
          <button
            v-for="r in reasons"
            :key="r"
            type="button"
            class="cc-reason"
            :class="{ 'cc-reason--selected': reason === r }"
            @click="reason = r"
          >
            <AppIcon :name="reason === r ? 'radio_button_checked' : 'radio_button_unchecked'" :size="20" :color="reason === r ? 'var(--cc-color-primary)' : 'var(--cc-line)'" />
            {{ r }}
          </button>
        </div>

        <div class="cc-alt">
          <AppIcon name="pause_circle" :size="20" color="var(--cc-color-primary)" />
          <p>Only want a break? Muting notifications from Settings does most of this without deleting anything.</p>
        </div>
      </div>

      <div class="cc-screen__footer">
        <AppButton variant="secondary" style="margin-bottom: 9px; border-color: #c0392b; color: var(--cc-error-surface-text)" @click="router.push({ name: 'delete-confirm', query: { reason } })">
          Continue to delete
        </AppButton>
        <AppButton variant="text" @click="router.back()">Keep my account</AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppButton, AppCard, AppHeader, AppIcon, AppListRow, MoneyAmount } from '@/components/ui';
import { useAppointments } from '@/composables/useAppointments';
import { useWallet } from '@/composables/useWallet';

const router = useRouter();
const { data: wallet } = useWallet();
const { data: appointments } = useAppointments();
const upcoming = computed(
  () => appointments.value?.data.filter((a) => a.status === 'confirmed' || a.status === 'requested') ?? [],
);

const reasons = ["I don't use it enough", 'Privacy concerns', 'Something else'];
const reason = ref('');

function formatSlot(iso: string) {
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
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
.cc-reasons {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.cc-reason {
  background: var(--cc-surface-0);
  border: 1px solid var(--cc-line);
  border-radius: 12px;
  padding: 11px 13px;
  display: flex;
  gap: 10px;
  align-items: center;
  font-family: var(--cc-font-interface);
  font-size: 13.5px;
  cursor: pointer;
  text-align: left;
}
.cc-reason--selected {
  border: 1.5px solid var(--cc-color-primary);
}
.cc-alt {
  display: flex;
  gap: 10px;
  padding: 13px 14px;
  border-radius: 14px;
  background: var(--cc-color-mist);
}
.cc-alt p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 19px;
  color: var(--cc-ink-600);
}
.cc-screen__footer {
  padding: 11px 16px calc(25px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
</style>
