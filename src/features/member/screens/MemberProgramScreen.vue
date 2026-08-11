<template>
  <ion-page>
    <AppHeader :title="title" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <template v-if="program === 'commitment'">
          <section class="cc-program__hero cc-program__hero--dark">
            <div class="cc-program__eyebrow">TOTAL COMMITTED</div>
            <div class="cc-program__money">$2,000.00</div>
            <div class="cc-program__metrics"><span><i>Interest paid</i>$108.00</span><span><i>Rate</i>1.8%/mo</span><span><i>Lock ends</i>12 Apr 27</span></div>
          </section>
          <h2 class="cc-program__section-title">Your cycle</h2>
          <AppCard>
            <div class="cc-program__row"><span>Cycle CMT-2041</span><AppBadge label="LOCKED 8 MO LEFT" tone="warning" /></div>
            <p>Month 4 of 12 <strong>12 Apr 26 → 12 Apr 27</strong></p>
            <div class="cc-program__bar"><i style="width:33%" /></div>
            <div class="cc-program__columns"><span><i>Principal</i>$2,000.00</span><span><i>Interest available</i><b>$108.00</b></span><span><i>Next payout</i>1 Sep</span></div>
          </AppCard>
          <div class="cc-program__notice"><AppIcon name="lock" :size="20" color="var(--cc-color-primary)" /><p>Interest is now withdrawable. Your principal remains locked until the end of this cycle.</p></div>
          <AppCard style="padding: 0"><AppListRow title="Start another cycle" subtitle="Each cycle locks separately for 12 months" icon="add_circle" chevron clickable @click="showInfo('A server quote is required before starting a new commitment.')" /></AppCard>
        </template>

        <template v-else-if="program === 'cooperative'">
          <section class="cc-program__savings">
            <div class="cc-program__ring"><strong>18</strong><span>of 52 weeks</span></div>
            <div><span class="cc-program__eyebrow">TOTAL SAVED</span><div class="cc-program__money">$180.00</div><p>18 consecutive weeks · $10.00 each Friday</p></div>
          </section>
          <div class="cc-program__warning"><AppIcon name="event_repeat" :size="20" color="var(--cc-color-warning-text)" /><p><strong>Week 19 due Friday 7 Aug</strong><br />$10.00 will be taken from your wallet.</p></div>
          <div class="cc-program__tiles"><AppCard><span>Savings type</span><strong>Open</strong><small>Help allowed</small></AppCard><AppCard><span>Help cap</span><strong>$500.00</strong><small>50-week limit</small></AppCard><AppCard><span>Cycle ends</span><strong>28 Mar</strong><small>2027</small></AppCard></div>
          <div class="cc-program__notice"><AppIcon name="volunteer_activism" :size="20" color="var(--cc-color-primary)" /><p><strong>You are eligible for help</strong><br />12 weeks was the requirement; you are at 18. Up to $500 with three guarantors.</p></div>
          <h2 class="cc-program__section-title">Recent weeks</h2>
          <AppCard style="padding: 0"><AppListRow title="Week 18" subtitle="2 Aug · auto" icon="check_circle" /><AppListRow title="Week 17" subtitle="26 Jul · auto" icon="check_circle" /><AppListRow title="Week 16" subtitle="19 Jul · manual top-up" icon="check_circle" :divider="false" /></AppCard>
        </template>

        <template v-else-if="program === 'rank'">
          <section class="cc-program__rank-head"><AppIcon name="workspace_premium" :size="31" color="var(--cc-color-warning-text)" /><div><strong>Gold</strong><span>District Coordinator · level 3 of 7</span><small>CCI8804XO · since 12 May 2026</small></div></section>
          <div class="cc-program__tiles"><AppCard><span>Referrals</span><strong>128</strong></AppCard><AppCard><span>Monthly earning</span><strong>+$10.00</strong></AppCard><AppCard><span>Scope</span><strong>District</strong></AppCard></div>
          <AppCard><div class="cc-program__row"><strong>Next: Diamond · State Coordinator</strong><span>$50/mo</span></div><p>177 referrals to go <strong>128 / 305</strong></p><div class="cc-program__bar"><i style="width:42%" /></div><div class="cc-program__inline-note"><AppIcon name="info" :size="18" color="var(--cc-color-warning-text)" />Diamond also needs one Crux II member in your Basic Network line.</div></AppCard>
          <h2 class="cc-program__section-title">What Gold gives you</h2>
          <AppCard style="padding: 0"><AppListRow title="$10.00 credited monthly to your wallet" icon="payments" /><AppListRow title="Host Point Facility sessions in your district" icon="videocam" /><AppListRow title="District Coordinator recognition and scope" icon="workspace_premium" :divider="false" /></AppCard>
        </template>

        <template v-else-if="program === 'network'">
          <div class="cc-program__chips"><AppBadge label="ALL 128" /><AppBadge label="NETWORK 73" /><AppBadge label="CARE 29" /><AppBadge label="COOP 18" /></div>
          <AppCard class="cc-program__network-stats"><span>Direct<strong>31</strong></span><span>Level 2<strong>64</strong></span><span>Level 3+<strong>33</strong></span><span>Aug<strong>+4</strong></span></AppCard>
          <h2 class="cc-program__section-title">Level 1 · direct <small>31 members</small></h2>
          <AppCard style="padding: 0"><AppListRow title="Ibrahim Bello" subtitle="Silver · 14 in his line" icon="person" chevron clickable @click="showInfo('Downline details are visible within your permitted scope.')" /><AppListRow title="Grace Adeniyi" subtitle="Bronze · 9 in her line" icon="person" chevron clickable @click="showInfo('Downline details are visible within your permitted scope.')" /><AppListRow title="Tunde Nwachukwu" subtitle="Bronze · 6 in his line" icon="person" chevron clickable @click="showInfo('Downline details are visible within your permitted scope.')" /><AppListRow title="Samuel Ajayi" subtitle="No rank yet · 3 in his line" icon="person" chevron clickable :divider="false" @click="showInfo('Downline details are visible within your permitted scope.')" /></AppCard>
          <div class="cc-program__notice"><AppIcon name="account_tree" :size="20" color="var(--cc-color-primary)" /><p>Counts come from CruxCare and include every platform a person joined through. A person is counted once.</p></div>
        </template>

        <template v-else>
          <section class="cc-program__earnings"><span>JULY 2026</span><strong>$10.00</strong><p>Current month remains in progress until CruxCare closes it.</p></section>
          <AppCard style="padding: 0"><AppListRow title="Gold rank earning" subtitle="1 Aug · monthly credit" icon="workspace_premium"><template #trailing><b class="cc-program__positive">+$10.00</b></template></AppListRow><AppListRow title="Commitment interest" subtitle="1 Aug · July cycle" icon="trending_up" :divider="false"><template #trailing><b class="cc-program__positive">+$36.00</b></template></AppListRow></AppCard>
          <div class="cc-program__notice"><AppIcon name="receipt_long" :size="20" color="var(--cc-color-primary)" /><p>Every credit has a reference and appears in your wallet ledger.</p></div>
        </template>
      </div>
    </ion-content>
    <ion-footer v-if="program === 'commitment' || program === 'cooperative'" class="cc-program__footer">
      <AppButton v-if="program === 'commitment'" variant="secondary" @click="showInfo('A server quote is required before withdrawing interest.')">Withdraw interest</AppButton>
      <AppButton v-if="program === 'commitment'" @click="showInfo('A server quote is required before starting a new commitment.')">New commitment</AppButton>
      <AppButton v-if="program === 'cooperative'" variant="secondary" @click="showInfo('Your eligibility and guarantors are checked before you can request help.')">Request help</AppButton>
      <AppButton v-if="program === 'cooperative'" @click="router.push({ name: 'wallet-home' })">Contribute</AppButton>
    </ion-footer>
    <ion-footer v-else-if="program === 'rank'" class="cc-program__footer"><AppButton @click="copyReferral">Share your referral link</AppButton></ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonContent, IonFooter, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppBadge, AppButton, AppCard, AppHeader, AppIcon, AppListRow } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';

const props = defineProps<{ program: 'commitment' | 'cooperative' | 'rank' | 'network' | 'earnings' }>();
const router = useRouter();
const auth = useAuthStore();
const toast = useToast();
const title = computed(() => ({ commitment: 'Commitment', cooperative: 'Cooperative', rank: 'Rank', network: 'Your network', earnings: 'Earnings history' }[props.program]));

async function copyReferral() {
  const referral = auth.user?.membership?.cruxId;
  if (referral && navigator.clipboard) await navigator.clipboard.writeText(referral);
  await toast.show('Your Crux ID is ready to share', 'success');
}
async function showInfo(message: string) { await toast.show(message, 'info'); }
</script>

<style scoped>
.cc-screen { --background:var(--cc-surface-app); }.cc-screen__pad { display:flex; flex-direction:column; gap:14px; padding:16px 16px 28px; }.cc-program__hero { border-radius:var(--cc-radius-lg); padding:17px; }.cc-program__hero--dark { background:var(--cc-color-primary-dark); color:#fff; }.cc-program__eyebrow { font-family:var(--cc-font-mono); font-size:10px; letter-spacing:.07em; }.cc-program__money { margin-top:4px; font-family:var(--cc-font-mono); font-size:26px; font-weight:700; letter-spacing:-.02em; }.cc-program__metrics,.cc-program__tiles,.cc-program__columns { display:flex; gap:8px; margin-top:14px; }.cc-program__metrics span,.cc-program__columns span { flex:1; padding:10px; border-radius:var(--cc-radius-md); background:rgba(255,255,255,.14); font-family:var(--cc-font-mono); font-size:12px; }.cc-program__metrics i,.cc-program__columns i,.cc-program__tiles span { display:block; margin-bottom:3px; color:inherit; font-family:var(--cc-font-interface); font-size:10px; font-style:normal; opacity:.76; }.cc-program__section-title { margin:2px 0 -2px; color:var(--cc-ink-900); font-family:var(--cc-font-interface); font-size:15px; }.cc-program__section-title small { color:var(--cc-ink-600); font-size:11px; font-weight:400; }.cc-program__row { display:flex; justify-content:space-between; align-items:center; gap:8px; color:var(--cc-ink-900); font-family:var(--cc-font-interface); font-size:13px; }.cc-program__row > span { color:var(--cc-ink-600); font-family:var(--cc-font-mono); font-size:11px; }.cc-program__row + p,.cc-program__savings p,.cc-program__earnings p { margin:8px 0; color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:11px; line-height:16px; }.cc-program__row + p strong { float:right; color:var(--cc-ink-900); }.cc-program__bar { height:7px; border-radius:var(--cc-radius-pill); background:var(--cc-color-mist); overflow:hidden; }.cc-program__bar i { display:block; height:100%; border-radius:inherit; background:var(--cc-color-primary); }.cc-program__columns { margin-top:12px; }.cc-program__columns span { padding:0; background:transparent; color:var(--cc-ink-900); }.cc-program__columns b,.cc-program__positive { color:var(--cc-color-success-text); }.cc-program__notice,.cc-program__warning { display:flex; gap:10px; align-items:flex-start; padding:13px; border-radius:var(--cc-radius-lg); background:var(--cc-color-mist); }.cc-program__warning { background:var(--cc-color-warning-tint); }.cc-program__notice p,.cc-program__warning p { margin:0; color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:12px; line-height:18px; }.cc-program__warning p { color:var(--cc-color-warning-text); }.cc-program__savings { display:flex; align-items:center; gap:16px; padding:17px; border:1px solid var(--cc-line); border-radius:var(--cc-radius-lg); background:var(--cc-surface-0); }.cc-program__ring { display:flex; flex:0 0 94px; flex-direction:column; align-items:center; justify-content:center; width:94px; height:94px; border:9px solid var(--cc-color-mist); border-top-color:var(--cc-color-primary); border-radius:999px; box-sizing:border-box; }.cc-program__ring strong { color:var(--cc-ink-900); font-family:var(--cc-font-mono); font-size:20px; }.cc-program__ring span { color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:9px; }.cc-program__tiles > :deep(.cc-card) { flex:1; min-width:0; padding:11px; }.cc-program__tiles strong,.cc-program__tiles small { display:block; color:var(--cc-ink-900); font-family:var(--cc-font-mono); font-size:12px; }.cc-program__tiles small { color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:9px; }.cc-program__rank-head { display:flex; gap:12px; align-items:center; }.cc-program__rank-head div { display:flex; flex-direction:column; }.cc-program__rank-head strong { color:var(--cc-ink-900); font-family:var(--cc-font-interface); font-size:18px; }.cc-program__rank-head span { color:var(--cc-ink-400); font-family:var(--cc-font-interface); font-size:11px; }.cc-program__rank-head small { margin-top:2px; color:var(--cc-color-primary); font-family:var(--cc-font-mono); font-size:10px; }.cc-program__inline-note { display:flex; gap:8px; margin-top:12px; color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:11px; line-height:16px; }.cc-program__chips { display:flex; flex-wrap:wrap; gap:8px; }.cc-program__network-stats { display:flex; justify-content:space-between; padding:13px; }.cc-program__network-stats span { display:flex; flex:1; flex-direction:column; color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:10px; }.cc-program__network-stats strong { color:var(--cc-ink-900); font-family:var(--cc-font-mono); font-size:15px; }.cc-program__earnings { padding:16px; border-radius:var(--cc-radius-lg); background:var(--cc-color-primary-dark); color:#fff; }.cc-program__earnings span { font-family:var(--cc-font-mono); font-size:10px; letter-spacing:.07em; }.cc-program__earnings strong { display:block; margin-top:6px; font-family:var(--cc-font-mono); font-size:28px; }.cc-program__earnings p { color:#cde7e1; }.cc-program__footer { display:flex; gap:8px; padding:10px 16px calc(16px + env(safe-area-inset-bottom)); border-top:1px solid var(--cc-divider); background:var(--cc-surface-0); }.cc-program__footer :deep(.cc-btn) { flex:1; font-size:13px; }
</style>
