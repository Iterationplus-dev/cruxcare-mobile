<template>
  <ion-page>
    <AppHeader title="Payment methods" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <AppSectionLabel label="Cards and accounts" />

        <template v-if="methods.length">
          <AppCard
            v-for="m in methods"
            :key="m.label"
            class="cc-pm"
            :class="{ 'cc-pm--expired': m.expired }"
          >
            <div class="cc-pm__head">
              <AppIcon
                :name="m.expired ? 'credit_card_off' : 'credit_card'"
                :size="22"
                :color="m.expired ? 'var(--cc-color-warning-text)' : 'var(--cc-ink-600)'"
              />
              <div class="cc-pm__body">
                <div class="cc-text-body-strong" style="font-size: 14.5px">{{ m.label }}</div>
                <div v-if="m.expired" class="cc-pm__expired-note">Expired</div>
              </div>
            </div>
            <!-- PR6 puts the expired-card actions inline on the card, where the
                 problem is, rather than behind an overflow menu. -->
            <div v-if="m.expired" class="cc-pm__actions">
              <AppButton variant="secondary" @click="onAdd">Update</AppButton>
              <AppButton variant="secondary" class="cc-pm__remove" @click="remove(m)">Remove</AppButton>
            </div>
          </AppCard>
        </template>

        <!-- PR6's dashed add tile. Offered only where the provider can actually
             vault a method; otherwise it would list a card that can never be
             charged again. -->
        <button v-if="canSaveMethods" type="button" class="cc-pm__add" @click="onAdd">
          <AppIcon name="add_card" :size="24" color="var(--cc-color-primary)" />
          <span class="cc-text-body-strong" style="font-size: 14.5px">Add a payment method</span>
          <span class="cc-text-caption">Card, bank transfer or wallet balance</span>
        </button>

        <EmptyState
          v-else
          icon="credit_card"
          title="Cards are entered at checkout"
          message="Your payment provider collects card details in its own secure sheet each time you pay, so there is nothing to save here."
        />

        <AppSectionLabel label="How payments run" />
        <AppCard style="padding: 0">
          <AppListRow
            title="Pay from wallet first"
            :subtitle="walletFirstSubtitle"
          >
            <template #trailing>
              <label class="cc-toggle">
                <input
                  type="checkbox"
                  :checked="payFromWalletFirst"
                  :disabled="savingPrefs"
                  @change="setPreference('payFromWalletFirst', $event)"
                />
                <span class="cc-toggle__track"><span class="cc-toggle__thumb" /></span>
              </label>
            </template>
          </AppListRow>
          <AppListRow
            title="Save cards for next time"
            subtitle="Stored by the payment provider, not CruxCare"
            :divider="false"
          >
            <template #trailing>
              <label class="cc-toggle">
                <input
                  type="checkbox"
                  :checked="saveMethods"
                  :disabled="savingPrefs"
                  @change="setPreference('saveMethods', $event)"
                />
                <span class="cc-toggle__track"><span class="cc-toggle__thumb" /></span>
              </label>
            </template>
          </AppListRow>
        </AppCard>

        <div class="cc-pm__note">
          <AppIcon name="lock" :size="18" color="var(--cc-ink-600)" />
          <p>Card numbers never reach CruxCare servers. Provider to be confirmed at build.</p>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import {
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppListRow,
  AppSectionLabel,
} from '@/components/ui';
import { EmptyState } from '@/components/state';
import { paymentProvider } from '@/services/payment';
import { authApi } from '@/api/auth.api';
import { useAuthStore } from '@/stores/auth';
import { useWallet } from '@/composables/useWallet';
import { useToast } from '@/composables/useToast';
import { formatMoney } from '@/utils/money';
import { ApiError } from '@/types/api';

/**
 * PR6 · Payment methods — expired-card state inline, provider left open.
 *
 * "How payments run" now has columns behind it, so both toggles persist. They
 * default to the behaviour the app already had, which means switching one on is
 * not a change for anyone who never opens this screen.
 */
interface SavedMethod {
  label: string;
  expired: boolean;
}

const auth = useAuthStore();
const toast = useToast();
const { data: wallet } = useWallet();

const methods = ref<SavedMethod[]>([]);
const savingPrefs = ref(false);

const payFromWalletFirst = computed(
  () => auth.user?.paymentPreferences?.payFromWalletFirst ?? true,
);
const saveMethods = computed(() => auth.user?.paymentPreferences?.saveMethods ?? true);

/** PR6 shows the balance in this line. Shown only once the wallet has loaded —
 *  a placeholder figure here would be a claim about someone's money. */
const walletFirstSubtitle = computed(() => {
  const balance = wallet.value;
  if (!balance) return 'Card covers anything your balance does not';
  return `Balance ${formatMoney(balance.available, balance.currency)} · card covers the rest`;
});

async function setPreference(key: 'payFromWalletFirst' | 'saveMethods', event: Event) {
  const input = event.target as HTMLInputElement;
  const wanted = input.checked;

  savingPrefs.value = true;
  try {
    auth.user = await authApi.updatePaymentPreferences({ [key]: wanted });
  } catch (error) {
    // Snap back rather than leaving the switch ahead of the server.
    input.checked = !wanted;
    const message =
      error instanceof ApiError
        ? error.message
        : 'We could not save that. Check your connection and try again.';
    await toast.show(message, 'danger', { title: 'Not saved' });
  } finally {
    savingPrefs.value = false;
  }
}

/**
 * Monnify's checkout SDK charges one transaction at a time and has no vaulting
 * flow, so under that provider there is nothing to save. Saying so is better
 * than offering an "Add a payment method" tile that lists a card which can
 * never be charged again.
 */
const canSaveMethods = typeof paymentProvider.collectPaymentMethod === 'function';

async function onAdd() {
  if (!paymentProvider.collectPaymentMethod) return;
  const { label } = await paymentProvider.collectPaymentMethod();
  methods.value.push({ label, expired: false });
}

function remove(method: SavedMethod) {
  methods.value = methods.value.filter((m) => m !== method);
}
</script>

<style scoped>
.cc-toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 24px;
  flex: none;
}
.cc-toggle input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
}
.cc-toggle__track {
  display: block;
  width: 40px;
  height: 24px;
  border-radius: 999px;
  background: var(--cc-line);
  padding: 2px;
  box-sizing: border-box;
}
.cc-toggle__thumb {
  display: block;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: #fff;
  transition: transform var(--cc-motion-fast) var(--cc-ease-out);
}
.cc-toggle input:checked + .cc-toggle__track {
  background: var(--cc-color-primary);
}
.cc-toggle input:checked + .cc-toggle__track .cc-toggle__thumb {
  transform: translateX(16px);
}
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
  flex-direction: column;
  gap: 12px;
}
.cc-pm--expired {
  border-color: var(--cc-color-warning-text);
}
.cc-pm__head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cc-pm__body {
  flex: 1;
  min-width: 0;
}
.cc-pm__expired-note {
  font-size: 12.5px;
  color: var(--cc-color-warning-text);
}
.cc-pm__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.cc-pm__remove {
  --cc-button-label: var(--cc-color-danger);
  color: var(--cc-color-danger);
}
.cc-pm__add {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 22px 16px;
  border: 1px dashed var(--cc-line-strong, var(--cc-line));
  border-radius: var(--cc-radius-lg);
  background: none;
  cursor: pointer;
  text-align: center;
}
.cc-pm__add:focus-visible {
  outline: 3px solid rgba(14, 124, 107, 0.35);
  outline-offset: 2px;
}
.cc-pm__note {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 14px;
  border-radius: var(--cc-radius-lg);
  background: var(--cc-color-mist);
  margin-top: 4px;
}
.cc-pm__note p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cc-ink-700);
}
</style>
