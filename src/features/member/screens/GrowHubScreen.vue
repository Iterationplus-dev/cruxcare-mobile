<template>
  <ion-page>
    <AppHeader title="Grow" :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <section class="cc-grow__intro">
          <AppIcon name="trending_up" :size="25" color="var(--cc-color-primary)" />
          <div>
            <h2>Build steadily, see it clearly</h2>
            <p>Your network, rank, commitment and cooperative activity in one place.</p>
          </div>
        </section>

        <AppCard style="padding: 0">
          <AppListRow title="Network" subtitle="128 people across care, shop and cooperative" icon="groups" chevron clickable @click="router.push({ name: 'member-network' })" />
          <AppListRow title="Rank" subtitle="Gold · 177 referrals to Diamond" icon="workspace_premium" chevron clickable @click="router.push({ name: 'member-rank' })" />
          <AppListRow title="Earnings history" subtitle="Open month is marked in progress" icon="receipt_long" chevron clickable :divider="false" @click="router.push({ name: 'member-earnings' })" />
        </AppCard>

        <div class="cc-grow__section-title">Your programmes</div>
        <AppCard style="padding: 0">
          <AppListRow title="Commitment" subtitle="$2,000 committed · 1.8% per month" icon="savings" chevron clickable @click="router.push({ name: 'member-commitment' })" />
          <AppListRow title="Cooperative" subtitle="Week 18 of 52 · help is available" icon="volunteer_activism" chevron clickable :divider="false" @click="router.push({ name: 'member-cooperative' })" />
        </AppCard>

        <div class="cc-grow__notice">
          <AppIcon name="info" :size="20" color="var(--cc-color-primary)" />
          <p>Figures and eligibility are confirmed by CruxCare before any money action.</p>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppCard, AppHeader, AppIcon, AppListRow } from '@/components/ui';

const router = useRouter();
</script>

<style scoped>
.cc-screen { --background: var(--cc-surface-app); }
.cc-screen__pad { display:flex; flex-direction:column; gap:14px; padding:16px; }
.cc-grow__intro { display:flex; gap:12px; align-items:flex-start; padding:14px; border-radius:var(--cc-radius-lg); background:var(--cc-color-mist); }
.cc-grow__intro h2 { margin:0 0 3px; color:var(--cc-ink-900); font-family:var(--cc-font-interface); font-size:16px; line-height:22px; }
.cc-grow__intro p, .cc-grow__notice p { margin:0; color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:12px; line-height:18px; }
.cc-grow__section-title { color:var(--cc-ink-900); font-family:var(--cc-font-interface); font-size:15px; font-weight:600; }
.cc-grow__notice { display:flex; gap:10px; align-items:flex-start; padding:13px; border:1px solid var(--cc-line); border-radius:var(--cc-radius-lg); background:var(--cc-surface-0); }
</style>
