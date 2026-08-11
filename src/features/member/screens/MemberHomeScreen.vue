<template>
  <ion-page>
    <ion-content class="cc-screen">
      <div class="cc-member-home__header">
        <AppAvatar :name="name" :src="auth.user?.avatarUrl ?? undefined" :size="40" />
        <div class="cc-member-home__identity">
          <div class="cc-text-mono">{{ auth.user?.membership?.cruxId }}</div>
          <div class="cc-text-body-strong" style="font-size: 14.5px">{{ auth.user?.firstName }}</div>
        </div>
        <button type="button" class="cc-member-home__bell" aria-label="Notifications" @click="router.push({ name: 'notifications' })">
          <AppIcon name="notifications" :size="22" color="var(--cc-ink-900)" />
        </button>
      </div>

      <div class="cc-member-home__body">
        <button type="button" class="cc-member-home__rank" @click="router.push({ name: 'member-rank' })">
          <div class="cc-member-home__rank-title"><AppIcon name="workspace_premium" :size="22" color="#ffffff" /> Gold · District Coordinator</div>
          <span>Level 3 of 7 · District · $10/mo</span>
          <div class="cc-member-home__rank-progress"><span>To Diamond · State Coordinator</span><strong>128 / 305</strong></div>
          <div class="cc-member-home__bar"><i /></div>
        </button>

        <div class="cc-member-home__stats">
          <AppStatTile icon="account_balance_wallet" label="Wallet" value="$248.50" @click="router.push({ name: 'wallet-home' })">
            <template #default><span class="cc-member-home__stat-detail">available</span></template>
          </AppStatTile>
          <AppStatTile icon="trending_up" label="This month" value="+$10" @click="router.push({ name: 'member-earnings' })">
            <template #default><span class="cc-member-home__stat-detail">rank + interest</span></template>
          </AppStatTile>
        </div>

        <AppCard style="padding: 0">
          <div class="cc-member-home__section-head">
            <span class="cc-text-body-strong" style="font-size: 15px">Your money at work</span>
            <button type="button" @click="router.push({ name: 'grow-hub' })">Grow</button>
          </div>
          <AppListRow title="Commitment" subtitle="Locked to 12 Jun 2027" icon="savings" chevron clickable @click="router.push({ name: 'member-commitment' })">
            <template #trailing><span class="cc-member-home__amount">$2,000<br /><i>+$108 int.</i></span></template>
          </AppListRow>
          <AppListRow title="Cooperative" subtitle="Week 18 of 52 · open" icon="savings" chevron clickable :divider="false" @click="router.push({ name: 'member-cooperative' })">
            <template #trailing><span class="cc-member-home__amount">$180<br /><em>due Fri</em></span></template>
          </AppListRow>
        </AppCard>

        <button type="button" class="cc-member-home__invite" @click="copyReferral">
          <span class="cc-member-home__invite-icon"><AppIcon name="ios_share" :size="22" color="var(--cc-color-primary)" /></span>
          <span class="cc-member-home__invite-copy"><strong>Invite with your Crux ID</strong><small>Share {{ auth.user?.membership?.cruxId }} and grow together.</small></span>
          <span class="cc-member-home__invite-action"><span>Share</span><AppIcon name="chevron_right" :size="20" color="var(--cc-color-primary)" /></span>
        </button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppAvatar, AppCard, AppIcon, AppListRow, AppStatTile } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { fullName } from '@/types/user';

const auth = useAuthStore();
const router = useRouter();
const toast = useToast();
const name = computed(() => (auth.user ? fullName(auth.user) : ''));

async function copyReferral() {
  const referral = auth.user?.membership?.cruxId;
  if (referral && navigator.clipboard) await navigator.clipboard.writeText(referral);
  await toast.show('Your Crux ID is ready to share', 'success');
}
</script>

<style scoped>
.cc-screen { --background: var(--cc-surface-app); }
.cc-member-home__header { display:flex; align-items:center; gap:10px; padding:calc(env(safe-area-inset-top) + 8px) 16px 18px; }
.cc-member-home__identity { flex:1; }
.cc-member-home__identity .cc-text-mono { color:var(--cc-color-primary); font-size:10.5px; }
.cc-member-home__bell { border:none; background:transparent; padding:10px; cursor:pointer; }
.cc-member-home__body { display:flex; flex-direction:column; gap:14px; padding:0 16px 24px; }
.cc-member-home__rank { width:100%; border:none; border-radius:var(--cc-radius-lg); background:var(--cc-color-primary-dark); color:#fff; padding:16px; text-align:left; cursor:pointer; }
.cc-member-home__rank-title { display:flex; align-items:center; gap:8px; font-family:var(--cc-font-interface); font-size:15px; font-weight:700; }
.cc-member-home__rank > span { display:block; margin-top:3px; color:#cde7e1; font-family:var(--cc-font-interface); font-size:11.5px; }
.cc-member-home__rank-progress { display:flex; justify-content:space-between; margin-top:14px; font-family:var(--cc-font-interface); font-size:10.5px; }
.cc-member-home__rank-progress strong { font-family:var(--cc-font-mono); font-size:12px; }
.cc-member-home__bar { height:6px; margin-top:6px; border-radius:var(--cc-radius-pill); background:rgba(255,255,255,.24); overflow:hidden; }
.cc-member-home__bar i { display:block; width:42%; height:100%; border-radius:inherit; background:var(--cc-color-success); }
.cc-member-home__stats { display:flex; gap:10px; }
.cc-member-home__stats :deep(.cc-stat) { flex:1; }
.cc-member-home__stat-detail { display:block; color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:10.5px; }
.cc-member-home__section-head { display:flex; justify-content:space-between; align-items:center; padding:13px 14px 8px; }
.cc-member-home__section-head button { border:none; background:transparent; color:var(--cc-color-primary); font-family:var(--cc-font-interface); font-size:12px; font-weight:600; cursor:pointer; }
.cc-member-home__amount { color:var(--cc-ink-900); font-family:var(--cc-font-mono); font-size:12px; line-height:16px; text-align:right; }
.cc-member-home__amount i { color:var(--cc-color-success-text); font-family:var(--cc-font-interface); font-size:10px; font-style:normal; }
.cc-member-home__amount em { color:var(--cc-color-warning-text); font-family:var(--cc-font-interface); font-size:10px; font-style:normal; }
.cc-member-home__invite { display:grid; grid-template-columns:42px minmax(0, 1fr) auto; align-items:center; width:100%; min-height:82px; gap:12px; padding:14px 16px; border:1px solid color-mix(in srgb, var(--cc-color-primary) 12%, transparent); border-radius:var(--cc-radius-lg); background:var(--cc-color-mist); color:var(--cc-ink-900); text-align:left; cursor:pointer; }
.cc-member-home__invite-icon { display:grid; width:42px; height:42px; place-items:center; border-radius:50%; background:var(--cc-surface-0); }
.cc-member-home__invite-copy { display:flex; min-width:0; flex-direction:column; gap:3px; }
.cc-member-home__invite-copy strong { font-family:var(--cc-font-interface); font-size:13px; line-height:18px; }
.cc-member-home__invite-copy small { overflow:hidden; color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:10.5px; line-height:15px; text-overflow:ellipsis; white-space:nowrap; }
.cc-member-home__invite-action { display:inline-flex; align-items:center; gap:2px; color:var(--cc-color-primary); font-family:var(--cc-font-interface); font-size:11px; font-weight:700; }
</style>
