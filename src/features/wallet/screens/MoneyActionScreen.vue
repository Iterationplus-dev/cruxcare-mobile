<template>
  <ion-page>
    <AppHeader :title="title" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <template v-if="stage === 'entry'">
          <section class="cc-money-action__intro">
            <AppIcon :name="actionIcon" :size="24" color="var(--cc-color-primary)" />
            <div><h2>{{ introTitle }}</h2><p>{{ introCopy }}</p></div>
          </section>
          <!-- Which purse, when more than one pays out. A single payable purse
               needs no question asked, and a server that sends none at all
               falls through to the e-wallet balance exactly as before. -->
          <div v-if="action === 'withdrawal' && payable.length > 1" class="cc-money-action__purses">
            <button
              v-for="purse in payable"
              :key="purse.slug"
              type="button"
              class="cc-money-action__purse"
              :class="{ 'cc-money-action__purse--on': purse.slug === selectedWallet }"
              :aria-pressed="purse.slug === selectedWallet"
              @click="selectedWallet = purse.slug"
            >
              <span class="cc-money-action__purse-name">{{ purse.name }}</span>
              <MoneyAmount :value="purse.available" :currency="purse.currency" />
              <span v-if="purse.minimumReached === false && purse.minimumWithdrawal" class="cc-money-action__purse-note">
                Opens at <MoneyAmount :value="purse.minimumWithdrawal" :currency="purse.currency" />
              </span>
            </button>
          </div>

          <AppCard v-if="activePurse" class="cc-money-action__balance">
            <span>{{ activePurse.name.toUpperCase() }}</span>
            <MoneyAmount :value="activePurse.available" :currency="activePurse.currency" size="display" />
            <!-- Named rather than hidden: money that is visible but not yet
                 clear is the most common reason a correct refusal looks wrong. -->
            <small v-if="activePurse.pending > 0" class="cc-money-action__pending">
              <MoneyAmount :value="activePurse.pending" :currency="activePurse.currency" />
              still clearing
            </small>
          </AppCard>
          <AppCard v-else-if="wallet" class="cc-money-action__balance"><span>AVAILABLE BALANCE</span><MoneyAmount :value="wallet.available" :currency="wallet.currency" size="display" /></AppCard>

          <!-- Requesting and being paid are different acts on different days,
               so this says both. Server-sent: "is it Tuesday?" is a question
               about the server's calendar, not the handset's. -->
          <div
            v-if="action === 'withdrawal' && windowLine"
            class="cc-money-action__notice"
            :class="{ 'cc-money-action__notice--shut': !windowOpen }"
          >
            <AppIcon
              name="calendar_month"
              :size="20"
              :color="windowOpen ? 'var(--cc-color-primary)' : 'var(--cc-color-warning-text)'"
            />
            <p>{{ windowLine }}</p>
          </div>
          <AppInput v-if="action === 'transfer'" v-model="recipient" label="Member Crux ID" placeholder="CCI8804XO" helper="The recipient receives the quoted amount after the admin charge." />
          <AppInput v-model="amount" label="Amount" type="number" inputmode="decimal" :placeholder="amountPlaceholder" :helper="amountHelper" />
          <div class="cc-money-action__notice"><AppIcon name="schedule" :size="20" color="var(--cc-color-warning-text)" /><p>A quote expires after five minutes. A security code is required before funds can move.</p></div>
        </template>

        <template v-else-if="stage === 'review' && quote">
          <div class="cc-money-action__eyebrow">SERVER QUOTE · EXPIRES IN 5 MIN</div>
          <h2 class="cc-money-action__title">Review before you submit</h2>
          <AppCard class="cc-money-action__quote">
            <div>
              <span>{{ amountLeavingLabel }}</span>
              <div class="cc-money-action__figure">
                <MoneyAmount :value="quote.amount" :currency="quote.currency" />
                <MoneyAmount v-if="local?.amount != null" :value="local.amount" :currency="local.currency" class="cc-money-action__local" />
              </div>
            </div>
            <div v-if="action !== 'cooperative-contribution'">
              <span>Admin charge</span>
              <div class="cc-money-action__figure">
                <MoneyAmount :value="-quote.fee" :currency="quote.currency" />
                <MoneyAmount v-if="local?.fee != null" :value="-local.fee" :currency="local.currency" class="cc-money-action__local" />
              </div>
            </div>
            <div v-if="quote.recipient"><span>To</span><strong>{{ quote.recipient }}</strong></div>
            <!-- On a withdrawal the local figure is what actually lands in the
                 bank, so it leads; the USD stays alongside because that is what
                 the wallet is debited. -->
            <div class="cc-money-action__quote-total">
              <span>{{ receivingLabel }}</span>
              <div class="cc-money-action__figure">
                <MoneyAmount
                  :value="local?.recipientReceives ?? quote.recipientReceives"
                  :currency="local?.recipientReceives != null ? local.currency : quote.currency"
                />
                <MoneyAmount v-if="local?.recipientReceives != null" :value="quote.recipientReceives" :currency="quote.currency" class="cc-money-action__local" />
              </div>
            </div>
            <div>
              <span>Wallet after action</span>
              <div class="cc-money-action__figure">
                <MoneyAmount :value="quote.balanceAfter" :currency="quote.currency" />
                <MoneyAmount v-if="local?.balanceAfter != null" :value="local.balanceAfter" :currency="local.currency" class="cc-money-action__local" />
              </div>
            </div>
          </AppCard>
          <p v-if="local" class="cc-money-action__rate">
            Converted at {{ formatMoney(local.rate, local.currency) }} per
            {{ formatMoney(1, quote.currency) }}<template v-if="local.rateSource === 'system'">, an indicative rate</template>.
            Your wallet is debited in {{ quote.currency }}.
          </p>
          <div class="cc-money-action__notice"><AppIcon name="lock" :size="20" color="var(--cc-color-primary)" /><p>This quote came from CruxCare. Confirming opens step-up authentication; it does not imply immediate settlement.</p></div>
        </template>

        <template v-else-if="submission">
          <section class="cc-money-action__submitted"><div><AppIcon name="schedule" :size="33" color="var(--cc-color-warning-text)" /></div><div class="cc-money-action__eyebrow">SUBMITTED FOR PROCESSING</div><h2>{{ submittedTitle }}</h2><p>{{ submittedCopy }}</p></section>
          <AppCard class="cc-money-action__receipt"><span>REFERENCE</span><strong>{{ submission.reference }}</strong><small>Submitted from a verified server quote</small></AppCard>
        </template>
      </div>
    </ion-content>
    <ion-footer class="cc-money-action__footer">
      <AppButton v-if="stage === 'entry'" :loading="quoting" :disabled="!canQuote" @click="requestQuote">{{ quoteLabel }}</AppButton>
      <template v-else-if="stage === 'review'"><AppButton variant="secondary" @click="stage = 'entry'">Edit amount</AppButton><AppButton :loading="requestingCode" @click="openStepUp">Confirm with security code</AppButton></template>
      <AppButton v-else @click="finishAction">{{ action === 'cooperative-contribution' ? 'Back to cooperative' : 'View wallet' }}</AppButton>
    </ion-footer>
    <AppSheet v-model="stepUpOpen" title="Confirm this action">
      <p class="cc-money-action__sheet-copy">Enter the five-digit security code queued for your email. Delivery can take a moment.</p>
      <AppInput v-model="securityCode" label="Security code" inputmode="numeric" placeholder="12345" />
      <AppButton style="margin-top: 16px" :loading="submitting" :disabled="securityCode.length !== 5" @click="verifyAndSubmit">Verify and submit</AppButton>
    </AppSheet>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonContent, IonFooter, IonPage } from '@ionic/vue';
import { useQueryClient } from '@tanstack/vue-query';
import { useRoute, useRouter } from 'vue-router';
import { AppButton, AppCard, AppHeader, AppIcon, AppInput, AppSheet, MoneyAmount } from '@/components/ui';
import { walletApi } from '@/api/wallet.api';
import { useWallet } from '@/composables/useWallet';
import { useToast } from '@/composables/useToast';
import { formatMoney } from '@/utils/money';
import { moneyRefusal, withdrawalWindowRefusal } from '@/features/wallet/moneyActionErrors';
import { withdrawablePurses, windowSummary } from '@/features/wallet/walletPurses';
import { ApiError } from '@/types/api';
import type { MoneyActionKind, MoneyQuote, MoneySubmission, WalletSlug } from '@/types/wallet';

const props = defineProps<{ action: MoneyActionKind }>();
const router = useRouter();
const route = useRoute();
const queryClient = useQueryClient();
const toast = useToast();
const { data: wallet } = useWallet();

/* ---- Which purse a withdrawal empties -------------------------------- */

/** Only the purses the server says pay out. Which those are is its rule, not
 *  a list kept here — the e-wallet deliberately is not one of them. */
const payable = computed(() => withdrawablePurses(wallet.value));

const requestedWallet = computed(() => {
  const asked = route.query.wallet;
  return typeof asked === 'string' ? (asked as WalletSlug) : null;
});

const selectedWallet = ref<WalletSlug | null>(null);

/**
 * Settle on a purse once the wallet has loaded: whatever the caller asked for
 * if it actually pays out, otherwise the first that does.
 *
 * Left null until then rather than defaulted to `cash`, so the app never names
 * a purse it has not seen — and never silently withdraws from one the user did
 * not choose.
 */
watch(
  [payable, requestedWallet],
  ([purses, asked]) => {
    if (!purses.length) return;
    if (selectedWallet.value && purses.some((p) => p.slug === selectedWallet.value)) return;
    const wanted = asked && purses.find((p) => p.slug === asked);
    selectedWallet.value = (wanted ?? purses[0]).slug;
  },
  { immediate: true },
);

const activePurse = computed(
  () => payable.value.find((p) => p.slug === selectedWallet.value) ?? null,
);

const withdrawalWindow = computed(() => wallet.value?.withdrawalWindow);
const windowLine = computed(() => windowSummary(withdrawalWindow.value));
/** Absent window reads as open: an older server enforces no window, and
 *  disabling the control on a rule that does not exist would be worse. */
const windowOpen = computed(() => withdrawalWindow.value?.open ?? true);
const amount = ref('');
const recipient = ref('');
const stage = ref<'entry' | 'review' | 'submitted'>('entry');
const quote = ref<MoneyQuote | null>(null);
const submission = ref<MoneySubmission | null>(null);
const quoting = ref(false);
const requestingCode = ref(false);
const submitting = ref(false);
const stepUpOpen = ref(false);
const securityCode = ref('');
// A pasted code may carry spaces or a "Code:" prefix; keep only the digits.
watch(securityCode, (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 5);
  if (digits !== value) securityCode.value = digits;
});

/** The server-converted twin of the quote. Null for anyone with no supported
 * country, which is the common case — the screen then reads exactly as before.
 * Never re-converted here: the quote holds its own rate. */
const local = computed(() => quote.value?.local ?? null);

const isContribution = computed(() => props.action === 'cooperative-contribution');
const title = computed(() => props.action === 'withdrawal' ? 'Withdraw' : props.action === 'transfer' ? 'Member transfer' : 'Contribute');
const actionIcon = computed(() => props.action === 'withdrawal' ? 'arrow_outward' : props.action === 'transfer' ? 'swap_horiz' : 'savings');
const introTitle = computed(() => isContribution.value ? 'Add to your cooperative savings' : props.action === 'withdrawal' ? 'Move money to your payout account' : 'Send money to another member');
const introCopy = computed(() => isContribution.value ? 'Choose a contribution of at least $5. CruxCare will show the resulting wallet balance before you confirm.' : 'We will show the server quote, fee and resulting balance before anything is submitted.');
const amountPlaceholder = computed(() => isContribution.value ? 'Minimum $5' : props.action === 'withdrawal' ? 'Enter withdrawal amount' : 'Enter transfer amount');
const amountHelper = computed(() => isContribution.value ? 'You can make a weekly contribution or top up at any time.' : props.action === 'withdrawal' ? 'Minimum 5% admin charge is shown in your quote.' : 'The admin charge and what the recipient receives are shown in your quote.');
const amountLeavingLabel = computed(() => isContribution.value ? 'Contribution from wallet' : props.action === 'withdrawal' ? 'Amount leaving wallet' : 'Transfer amount');
const receivingLabel = computed(() => isContribution.value ? 'Added to cooperative savings' : props.action === 'withdrawal' ? 'You receive' : 'Member receives');
const submittedTitle = computed(() => isContribution.value ? 'Contribution submitted' : props.action === 'withdrawal' ? 'Withdrawal is processing' : 'Transfer is processing');
const submittedCopy = computed(() => isContribution.value ? 'Your cooperative savings and wallet will refresh with this contribution.' : 'CruxCare will update your wallet and send a notification when settlement is confirmed.');
const canQuote = computed(() => {
  const value = Number(amount.value);
  const meetsMinimum = isContribution.value ? value >= 5 : value > 0;
  if (!meetsMinimum) return false;
  if (props.action === 'transfer' && !recipient.value.trim()) return false;
  // Refused server-side anyway, and refused *before* a step-up code is spent on
  // a payout that was never going to be made — but a disabled button beats
  // finding that out by tapping.
  if (props.action === 'withdrawal' && !windowOpen.value) return false;
  return true;
});

const quoteLabel = computed(() =>
  props.action === 'withdrawal' && !windowOpen.value
    ? 'Withdrawals are closed right now'
    : 'Review server quote',
);

/**
 * Says which rule refused the money and with what figures, rather than the one
 * generic line this screen used to show for every failure alike.
 */
async function reportMoneyFailure(error: unknown, fallback: string) {
  // The window first: it is not a refusal about the money at all — nothing is
  // wrong with the amount or the balance, it is simply the wrong day — and
  // saying "not enough cleared" to somebody on a Saturday would be false.
  const closed = withdrawalWindowRefusal(error);
  if (closed) {
    await queryClient.invalidateQueries({ queryKey: ['wallet'] });
    await toast.show(closed.message, 'warning', { title: closed.title });
    return;
  }

  const refusal = moneyRefusal(error);
  if (refusal) {
    await toast.show(refusal.message, 'warning', { title: refusal.title });
    return;
  }
  await toast.show(error instanceof ApiError ? error : fallback, 'warning');
}

async function requestQuote() {
  if (!canQuote.value) return;
  quoting.value = true;
  try {
    quote.value = await walletApi.quoteMoneyAction({
      kind: props.action,
      amount: Number(amount.value),
      recipient: props.action === 'transfer' ? recipient.value.trim() : undefined,
      // Only a withdrawal names a purse. Transfers and cooperative
      // contributions spend the e-wallet and always have, so sending one here
      // would be inventing a choice the server does not offer.
      // `?? undefined`, not `?? 'cash'`: the field is omitted until the wallet
      // has loaded, so the app never names a purse it has not seen.
      wallet: props.action === 'withdrawal' ? (selectedWallet.value ?? undefined) : undefined,
    });
    stage.value = 'review';
  } catch (error) {
    await reportMoneyFailure(error, 'We could not create a server quote. Check the amount and try again.');
  } finally {
    quoting.value = false;
  }
}

async function openStepUp() {
  if (!quote.value) return;
  requestingCode.value = true;
  try {
    const delivery = await walletApi.requestMoneyStepUp(quote.value.id);
    stepUpOpen.value = true;
    await toast.show('Your security code was queued for ' + delivery.destination + '.', 'info', {
      title: 'Security code requested',
    });
  } catch {
    await toast.show('We could not request a security code. Please try again.', 'danger');
  } finally {
    requestingCode.value = false;
  }
}

async function verifyAndSubmit() {
  if (!quote.value) return;
  submitting.value = true;
  try {
    await walletApi.verifyMoneyStepUp(quote.value.id, securityCode.value);
    submission.value = await walletApi.submitMoneyAction(quote.value.id);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['wallet'] }),
      queryClient.invalidateQueries({ queryKey: ['wallet', 'ledger'] }),
    ]);
    stepUpOpen.value = false;
    stage.value = 'submitted';
  } catch (error) {
    // A quote is a price, not a permission: both limits are checked again here,
    // so a withdrawal quoted while the balance was above the floor can still be
    // refused at settlement.
    await reportMoneyFailure(error, 'The code could not be verified or the quote is no longer available.');
  } finally {
    submitting.value = false;
  }
}

function finishAction() {
  router.replace({ name: isContribution.value ? 'member-cooperative' : 'wallet-home' });
}
</script>
<style scoped>
.cc-screen { --background:var(--cc-surface-app); }.cc-screen__pad { display:flex; flex-direction:column; gap:14px; padding:16px 16px 28px; }.cc-money-action__intro { display:flex; gap:12px; align-items:flex-start; padding:14px; border-radius:var(--cc-radius-lg); background:var(--cc-color-mist); }.cc-money-action__intro h2,.cc-money-action__title { margin:0 0 4px; color:var(--cc-ink-900); font-family:var(--cc-font-interface); font-size:16px; line-height:22px; }.cc-money-action__intro p,.cc-money-action__submitted p { margin:0; color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:12px; line-height:18px; }.cc-money-action__balance { display:flex; flex-direction:column; gap:4px; }.cc-money-action__balance > span,.cc-money-action__eyebrow,.cc-money-action__receipt > span { color:var(--cc-color-primary); font-family:var(--cc-font-mono); font-size:10px; font-weight:600; letter-spacing:.07em; }.cc-money-action__balance :deep(.cc-money) { font-size:26px; }.cc-money-action__notice { display:flex; gap:10px; padding:13px; border-radius:var(--cc-radius-lg); background:var(--cc-color-warning-tint); }.cc-money-action__notice p { margin:0; color:var(--cc-color-warning-text); font-family:var(--cc-font-interface); font-size:12px; line-height:18px; }.cc-money-action__quote { padding:0; overflow:hidden; }.cc-money-action__quote > div { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:13px 14px; border-bottom:1px solid var(--cc-divider); color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:12px; }.cc-money-action__quote > div:last-child { border-bottom:none; }.cc-money-action__quote :deep(.cc-money),.cc-money-action__quote strong { color:var(--cc-ink-900); font-family:var(--cc-font-mono); font-size:13px; }.cc-money-action__quote-total { background:var(--cc-color-mist); color:var(--cc-ink-900) !important; font-weight:600; }.cc-money-action__figure { display:flex; flex-direction:column; align-items:flex-end; gap:1px; }.cc-money-action__quote :deep(.cc-money.cc-money-action__local) { color:var(--cc-ink-400); font-size:11px; font-weight:400; }.cc-money-action__rate { margin:0; color:var(--cc-ink-400); font-family:var(--cc-font-interface); font-size:11.5px; line-height:16px; }.cc-money-action__submitted { text-align:center; padding:24px 14px 8px; }.cc-money-action__submitted > div:first-child { display:grid; width:68px; height:68px; place-items:center; margin:0 auto 14px; border-radius:999px; background:var(--cc-color-warning-tint); }.cc-money-action__submitted h2 { margin:7px 0; color:var(--cc-ink-900); font-family:var(--cc-font-interface); font-size:21px; }.cc-money-action__submitted p { max-width:285px; margin:auto; }.cc-money-action__receipt { display:flex; flex-direction:column; gap:5px; text-align:center; }.cc-money-action__receipt strong { color:var(--cc-ink-900); font-family:var(--cc-font-mono); font-size:18px; }.cc-money-action__receipt small { color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:11px; }.cc-money-action__footer { display:flex; gap:8px; padding:10px 16px calc(16px + env(safe-area-inset-bottom)); border-top:1px solid var(--cc-divider); background:var(--cc-surface-0); }.cc-money-action__footer :deep(.cc-btn) { flex:1; font-size:13px; }.cc-money-action__sheet-copy { margin:0 0 14px; color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:12px; line-height:18px; }
/* Which purse the money leaves. Two or three options, so they sit side by side
   rather than behind a select — the balances are the whole basis of the
   choice and hiding them makes it a guess. */
.cc-money-action__purses { display:flex; gap:9px; flex-wrap:wrap; }
.cc-money-action__purse { flex:1 1 140px; min-width:0; display:flex; flex-direction:column; gap:3px; padding:12px 13px; border:1px solid var(--cc-line); border-radius:var(--cc-radius-lg); background:var(--cc-surface-0); font:inherit; text-align:left; cursor:pointer; }
.cc-money-action__purse--on { border-color:var(--cc-color-primary); background:var(--cc-color-mist); }
.cc-money-action__purse-name { font-family:var(--cc-font-interface); font-size:12.5px; font-weight:600; color:var(--cc-ink-900); }
.cc-money-action__purse-note { font-family:var(--cc-font-interface); font-size:11px; line-height:16px; color:var(--cc-ink-400); }
.cc-money-action__pending { color:var(--cc-ink-400); font-family:var(--cc-font-interface); font-size:11.5px; }
/* The open window is information, not a warning; only the shut one is amber. */
.cc-money-action__notice:not(.cc-money-action__notice--shut) { background:var(--cc-color-mist); }
.cc-money-action__notice:not(.cc-money-action__notice--shut) p { color:var(--cc-ink-600); }
</style>
