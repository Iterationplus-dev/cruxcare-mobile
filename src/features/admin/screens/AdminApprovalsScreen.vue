<template>
  <ion-page>
    <AppHeader title="Approvals" :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <div class="cc-admin__summary"><span>12 open · $6,240</span><div class="cc-admin__chips"><AppBadge label="PAYOUTS 7" /><AppBadge label="COOP HELP 3" /><AppBadge label="NOTICES 2" /></div></div>
        <div class="cc-admin__warning"><AppIcon name="schedule" :size="20" color="var(--cc-color-warning-text)" /><p><strong>2 items are over 24 hours old</strong><br />Oldest waiting 31 hours · sorted first</p></div>
        <AppCard style="padding: 0">
          <section v-for="item in items" :key="item.title" class="cc-admin__item"><div class="cc-admin__item-head"><strong>{{ item.title }}</strong><span>{{ item.amount }}</span></div><p>{{ item.detail }}</p><div class="cc-admin__tags"><AppBadge v-for="tag in item.tags" :key="tag" :label="tag" tone="success" /></div><div class="cc-admin__actions"><AppButton @click="review(item.title)">Review</AppButton><AppButton variant="secondary" @click="hold(item.title)">Hold</AppButton></div></section>
        </AppCard>
        <p class="cc-admin__audit"><AppIcon name="history" :size="17" color="var(--cc-ink-400)" /> Every decision is audit-logged with your admin ID.</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { AppBadge, AppButton, AppCard, AppHeader, AppIcon } from '@/components/ui';
import { useToast } from '@/composables/useToast';

const toast = useToast();
const items = [
  { title: 'Withdrawal · Emeka Obi', amount: '$400.00', detail: 'CCI8804XO · fee $20.00 · receives $380.00', tags: ['BALANCE COVERS IT', 'IDENTITY VERIFIED', '31H WAITING'] },
  { title: 'Coop help · Grace Adeniyi', amount: '$500.00', detail: '14 weeks consistent · cap $500 · repay over 10 weeks', tags: ['3 OF 3 GUARANTORS', 'OPEN SAVINGS', 'NO PRIOR HELP'] },
  { title: '60-day notice · Tunde N.', amount: '$1,500.00', detail: 'Capital returns 2 Oct · notice served 3 Aug', tags: ['CYCLE COMPLETE', 'INTEREST PAID TO DATE'] },
];
async function review(title: string) { await toast.show(`${title} is ready for the server-side financial review.`, 'info'); }
async function hold(title: string) { await toast.show(`${title} is on hold. The member will see the status update.`, 'warning'); }
</script>

<style scoped>
.cc-screen { --background:var(--cc-surface-app); }.cc-screen__pad { display:flex; flex-direction:column; gap:14px; padding:16px; }.cc-admin__summary { display:flex; flex-direction:column; gap:10px; color:var(--cc-ink-600); font-family:var(--cc-font-mono); font-size:12px; }.cc-admin__chips,.cc-admin__tags,.cc-admin__actions { display:flex; flex-wrap:wrap; gap:7px; }.cc-admin__warning { display:flex; gap:10px; padding:13px; border-radius:var(--cc-radius-lg); background:var(--cc-color-warning-tint); }.cc-admin__warning p,.cc-admin__item p { margin:0; color:var(--cc-color-warning-text); font-family:var(--cc-font-interface); font-size:11px; line-height:16px; }.cc-admin__item { padding:14px; border-bottom:1px solid var(--cc-divider); }.cc-admin__item:last-child { border-bottom:none; }.cc-admin__item-head { display:flex; justify-content:space-between; gap:8px; color:var(--cc-ink-900); font-family:var(--cc-font-interface); font-size:13px; }.cc-admin__item-head span { font-family:var(--cc-font-mono); font-size:14px; }.cc-admin__item > p { margin:4px 0 9px; color:var(--cc-ink-600); }.cc-admin__tags { margin-bottom:10px; }.cc-admin__actions :deep(.cc-btn) { flex:1; font-size:13px; }.cc-admin__audit { display:flex; gap:7px; align-items:center; margin:0; color:var(--cc-ink-400); font-family:var(--cc-font-interface); font-size:11px; }
</style>
