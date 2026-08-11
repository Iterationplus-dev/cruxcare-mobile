<template>
  <ion-page>
    <AppHeader :title="title" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <template v-if="stage === 'entry'">
          <section class="cc-money-action__intro">
            <AppIcon :name="action === 'withdrawal' ? 'arrow_outward' : 'swap_horiz'" :size="24" color="var(--cc-color-primary)" />
            <div><h2>{{ action === 'withdrawal' ? 'Move money to your payout account' : 'Send money to another member' }}</h2><p>We will show the server quote, fee and resulting balance before anything is submitted.</p></div>
          </section>
          <AppCard v-if="wallet" class="cc-money-action__balance"><span>AVAILABLE BALANCE</span><MoneyAmount :value="wallet.available" :currency="wallet.currency" size="display" /></AppCard>
          <AppInput v-if="action === 'transfer'" v-model="recipient" label="Member Crux ID" placeholder="CCI8804XO" helper="The recipient receives the quoted amount after the admin charge." />
          <AppInput v-model="amount" label="Amount" type="number" inputmode="decimal" :placeholder="action === 'withdrawal' ? 'Enter withdrawal amount' : 'Enter transfer amount'" :helper="action === 'withdrawal' ? 'Minimum 5% admin charge is shown in your quote.' : 'The admin charge and what they receive are shown in your quote.'" />
          <div class="cc-money-action__notice"><AppIcon name="schedule" :size="20" color="var(--cc-color-warning-text)" /><p>A quote expires after five minutes. Money actions need a security code before they can be submitted.</p></div>
        </template>

        <template v-else-if="stage === 'review' && quote">
          <div class="cc-money-action__eyebrow">SERVER QUOTE · EXPIRES IN 5 MIN</div>
          <h2 class="cc-money-action__title">Review before you submit</h2>
          <AppCard class="cc-money-action__quote">
            <div><span>{{ action === 'withdrawal' ? 'Amount leaving wallet' : 'Transfer amount' }}</span><MoneyAmount :value="quote.amount" :currency="quote.currency" /></div>
            <div><span>Admin charge</span><MoneyAmount :value="-quote.fee" :currency="quote.currency" /></div>
            <div v-if="quote.recipient"><span>To</span><strong>{{ quote.recipient }}</strong></div>
            <div class="cc-money-action__quote-total"><span>{{ action === 'withdrawal' ? 'You receive' : 'Member receives' }}</span><MoneyAmount :value="quote.recipientReceives" :currency="quote.currency" /></div>
            <div><span>Wallet after action</span><MoneyAmount :value="quote.balanceAfter" :currency="quote.currency" /></div>
          </AppCard>
          <div class="cc-money-action__notice"><AppIcon name="lock" :size="20" color="var(--cc-color-primary)" /><p>This quote came from CruxCare. Confirming opens step-up authentication; it does not imply immediate settlement.</p></div>
        </template>

        <template v-else-if="submission">
          <section class="cc-money-action__submitted"><div><AppIcon name="schedule" :size="33" color="var(--cc-color-warning-text)" /></div><div class="cc-money-action__eyebrow">SUBMITTED FOR PROCESSING</div><h2>{{ action === 'withdrawal' ? 'Withdrawal is processing' : 'Transfer is processing' }}</h2><p>CruxCare will update your wallet and send a notification when settlement is confirmed.</p></section>
          <AppCard class="cc-money-action__receipt"><span>REFERENCE</span><strong>{{ submission.reference }}</strong><small>Submitted from a verified server quote</small></AppCard>
        </template>
      </div>
    </ion-content>
    <ion-footer class="cc-money-action__footer">
      <AppButton v-if="stage === 'entry'" :loading="quoting" :disabled="!canQuote" @click="requestQuote">Review server quote</AppButton>
      <template v-else-if="stage === 'review'"><AppButton variant="secondary" @click="stage = 'entry'">Edit amount</AppButton><AppButton @click="stepUpOpen = true">Confirm with security code</AppButton></template>
      <AppButton v-else @click="router.replace({ name: 'wallet-home' })">View wallet</AppButton>
    </ion-footer>
    <AppSheet v-model="stepUpOpen" title="Confirm this action">
      <p class="cc-money-action__sheet-copy">Enter the five-digit security code sent to your trusted channel. This is required before CruxCare accepts the request.</p>
      <AppInput v-model="securityCode" label="Security code" inputmode="numeric" placeholder="12345" />
      <AppButton style="margin-top: 16px" :loading="submitting" :disabled="securityCode.length !== 5" @click="verifyAndSubmit">Verify and submit</AppButton>
    </AppSheet>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonFooter, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppButton, AppCard, AppHeader, AppIcon, AppInput, AppSheet, MoneyAmount } from '@/components/ui';
import { walletApi } from '@/api/wallet.api';
import { useWallet } from '@/composables/useWallet';
import { useToast } from '@/composables/useToast';
import type { MoneyActionKind, MoneyQuote, MoneySubmission } from '@/types/wallet';

const props = defineProps<{ action: MoneyActionKind }>();
const router = useRouter();
const toast = useToast();
const { data: wallet } = useWallet();
const amount = ref('');
const recipient = ref('');
const stage = ref<'entry' | 'review' | 'submitted'>('entry');
const quote = ref<MoneyQuote | null>(null);
const submission = ref<MoneySubmission | null>(null);
const quoting = ref(false);
const submitting = ref(false);
const stepUpOpen = ref(false);
const securityCode = ref('');
const title = computed(() => (props.action === 'withdrawal' ? 'Withdraw' : 'Member transfer'));
const canQuote = computed(() => Number(amount.value) > 0 && (props.action !== 'transfer' || recipient.value.trim().length > 0));

async function requestQuote() {
  if (!canQuote.value) return;
  quoting.value = true;
  try {
    quote.value = await walletApi.quoteMoneyAction({ kind: props.action, amount: Number(amount.value), recipient: recipient.value });
    stage.value = 'review';
  } catch {
    await toast.show('We could not create a server quote. Check the amount and try again.', 'warning');
  } finally { quoting.value = false; }
}

async function verifyAndSubmit() {
  if (!quote.value) return;
  submitting.value = true;
  try {
    await walletApi.verifyMoneyStepUp(quote.value.id, securityCode.value);
    submission.value = await walletApi.submitMoneyAction(quote.value.id);
    stepUpOpen.value = false;
    stage.value = 'submitted';
  } catch {
    await toast.show('The code could not be verified or the quote is no longer available.', 'warning');
  } finally { submitting.value = false; }
}
</script>

<style scoped>
.cc-screen { --background:var(--cc-surface-app); }.cc-screen__pad { display:flex; flex-direction:column; gap:14px; padding:16px 16px 28px; }.cc-money-action__intro { display:flex; gap:12px; align-items:flex-start; padding:14px; border-radius:var(--cc-radius-lg); background:var(--cc-color-mist); }.cc-money-action__intro h2,.cc-money-action__title { margin:0 0 4px; color:var(--cc-ink-900); font-family:var(--cc-font-interface); font-size:16px; line-height:22px; }.cc-money-action__intro p,.cc-money-action__submitted p { margin:0; color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:12px; line-height:18px; }.cc-money-action__balance { display:flex; flex-direction:column; gap:4px; }.cc-money-action__balance > span,.cc-money-action__eyebrow,.cc-money-action__receipt > span { color:var(--cc-color-primary); font-family:var(--cc-font-mono); font-size:10px; font-weight:600; letter-spacing:.07em; }.cc-money-action__balance :deep(.cc-money) { font-size:26px; }.cc-money-action__notice { display:flex; gap:10px; padding:13px; border-radius:var(--cc-radius-lg); background:var(--cc-color-warning-tint); }.cc-money-action__notice p { margin:0; color:var(--cc-color-warning-text); font-family:var(--cc-font-interface); font-size:12px; line-height:18px; }.cc-money-action__quote { padding:0; overflow:hidden; }.cc-money-action__quote > div { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:13px 14px; border-bottom:1px solid var(--cc-divider); color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:12px; }.cc-money-action__quote > div:last-child { border-bottom:none; }.cc-money-action__quote :deep(.cc-money),.cc-money-action__quote strong { color:var(--cc-ink-900); font-family:var(--cc-font-mono); font-size:13px; }.cc-money-action__quote-total { background:var(--cc-color-mist); color:var(--cc-ink-900) !important; font-weight:600; }.cc-money-action__submitted { text-align:center; padding:24px 14px 8px; }.cc-money-action__submitted > div:first-child { display:grid; width:68px; height:68px; place-items:center; margin:0 auto 14px; border-radius:999px; background:var(--cc-color-warning-tint); }.cc-money-action__submitted h2 { margin:7px 0; color:var(--cc-ink-900); font-family:var(--cc-font-interface); font-size:21px; }.cc-money-action__submitted p { max-width:285px; margin:auto; }.cc-money-action__receipt { display:flex; flex-direction:column; gap:5px; text-align:center; }.cc-money-action__receipt strong { color:var(--cc-ink-900); font-family:var(--cc-font-mono); font-size:18px; }.cc-money-action__receipt small { color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:11px; }.cc-money-action__footer { display:flex; gap:8px; padding:10px 16px calc(16px + env(safe-area-inset-bottom)); border-top:1px solid var(--cc-divider); background:var(--cc-surface-0); }.cc-money-action__footer :deep(.cc-btn) { flex:1; font-size:13px; }.cc-money-action__sheet-copy { margin:0 0 14px; color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:12px; line-height:18px; }
</style>
