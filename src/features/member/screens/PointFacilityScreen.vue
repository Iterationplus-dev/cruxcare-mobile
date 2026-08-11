<template>
  <ion-page :class="{ 'cc-point--live': view === 'live' }">
    <template v-if="view === 'live'">
      <ion-content class="cc-point__live">
        <div class="cc-point__live-header"><button type="button" aria-label="Leave live room" @click="router.replace({ name: 'point-facility' })"><AppIcon name="arrow_back_ios_new" :size="22" color="#ffffff" /></button><span>Point Facility · live</span><AppIcon name="more_vert" :size="22" color="#ffffff" /></div>
        <div class="cc-point__live-body"><div class="cc-point__live-badge"><i /> LIVE NOW · 14 listening</div><h1>Morning words of encouragement</h1><p>Mrs. Chinwe Okoye</p><div class="cc-point__speaker"><AppIcon name="graphic_eq" :size="34" color="var(--cc-color-leaf)" /><span>Speaking now</span></div><div class="cc-point__attendees"><span>EO<br /><small>You</small></span><span>GA<br /><small>Grace</small></span><span>IB<br /><small>Ibrahim</small></span><span>+11<br /><small>Listening</small></span></div></div>
        <div class="cc-point__live-controls"><button type="button" @click="toggleMuted"><AppIcon :name="muted ? 'mic_off' : 'mic'" :size="26" color="#ffffff" /><span>{{ muted ? 'Muted' : 'Mute' }}</span></button><button type="button" @click="showInfo('Camera is optional for this audio-first room.')"><AppIcon name="videocam_off" :size="26" color="#ffffff" /><span>Camera</span></button><button type="button" @click="showInfo('Your hand is raised. The host will see it.')"><AppIcon name="front_hand" :size="26" color="#ffffff" /><span>Raise hand</span></button><button type="button" @click="showInfo('The report flow has been opened for this session.')"><AppIcon name="flag" :size="26" color="#ffffff" /><span>Report</span></button></div>
        <AppButton variant="secondary" class="cc-point__leave" @click="router.replace({ name: 'point-facility' })">Leave quietly</AppButton>
      </ion-content>
    </template>
    <template v-else>
      <AppHeader :title="view === 'session' ? 'Session details' : 'Point Facility'" show-back :botanical="false" />
      <ion-content class="cc-screen">
        <div class="cc-screen__pad">
          <template v-if="view === 'session'">
            <section class="cc-point__detail-head"><span>15:00 · TODAY</span><h1>Gentle chair exercises</h1><p>Health exercises · Samuel Ajayi · 45 min</p></section>
            <AppCard><AppListRow title="Hosted by Samuel Ajayi" subtitle="District Point Facility host" icon="person" /><AppListRow title="Places available" subtitle="8 of 20 places" icon="groups" :divider="false" /></AppCard>
            <div class="cc-point__notice"><AppIcon name="hearing" :size="22" color="var(--cc-color-primary)" /><p>This is an elder-friendly, audio-first session. You can join by voice with no camera.</p></div>
          </template>
          <template v-else>
            <section class="cc-point__intro"><h1>Point Facility</h1><p>Live company, encouragement and exercise</p></section>
            <section class="cc-point__live-card"><div class="cc-point__live-badge"><i /> LIVE NOW · 14 listening</div><h2>Morning words of encouragement</h2><p>Mrs. Chinwe Okoye · started 12 minutes ago</p><AppButton variant="secondary" @click="router.push({ name: 'point-facility-live' })">Join by voice</AppButton></section>
            <h2 class="cc-point__section-title">Later today</h2>
            <AppCard style="padding: 0"><AppListRow title="Gentle chair exercises" subtitle="15:00 · Health exercises · 45 min" icon="accessibility_new" chevron clickable @click="router.push({ name: 'point-facility-session' })" /><AppListRow title="Evening singing" subtitle="19:00 · Singing · Full" icon="music_note" chevron :divider="false" /></AppCard>
            <AppCard style="padding: 0"><AppListRow title="Free resources" subtitle="Readings and recordings · no plan needed" icon="library_music" chevron clickable @click="showInfo('Free resources are available to everyone.')" /></AppCard>
          </template>
        </div>
      </ion-content>
      <ion-footer v-if="view === 'session'" class="cc-point__footer"><AppButton @click="showInfo('Your place is reserved. We will remind you before it begins.')">Reserve your place</AppButton></ion-footer>
    </template>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonContent, IonFooter, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppButton, AppCard, AppHeader, AppIcon, AppListRow } from '@/components/ui';
import { useToast } from '@/composables/useToast';

withDefaults(defineProps<{ view?: 'home' | 'session' | 'live' }>(), { view: 'home' });
const router = useRouter();
const toast = useToast();
const muted = ref(true);
async function toggleMuted() { muted.value = !muted.value; await toast.show(muted.value ? 'You are muted' : 'You are unmuted', 'info'); }
async function showInfo(message: string) { await toast.show(message, 'info'); }
</script>

<style scoped>
.cc-screen { --background:var(--cc-surface-app); }.cc-screen__pad { display:flex; flex-direction:column; gap:16px; padding:16px; }.cc-point__intro h1,.cc-point__detail-head h1 { margin:0; color:var(--cc-ink-900); font-family:var(--cc-font-interface); font-size:20px; line-height:27px; }.cc-point__intro p,.cc-point__detail-head p { margin:3px 0 0; color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:14px; line-height:21px; }.cc-point__detail-head > span { display:block; margin-bottom:5px; color:var(--cc-color-primary); font-family:var(--cc-font-mono); font-size:10px; letter-spacing:.07em; }.cc-point__live-card { padding:18px; border-radius:var(--cc-radius-lg); background:var(--cc-color-primary-dark); color:#fff; }.cc-point__live-card h2 { margin:13px 0 3px; font-family:var(--cc-font-interface); font-size:18px; line-height:24px; }.cc-point__live-card p { margin:0 0 16px; color:#cde7e1; font-family:var(--cc-font-interface); font-size:13px; line-height:19px; }.cc-point__live-card :deep(.cc-btn) { color:var(--cc-color-primary-dark); }.cc-point__live-badge { display:flex; align-items:center; gap:6px; color:inherit; font-family:var(--cc-font-interface); font-size:11px; font-weight:700; }.cc-point__live-badge i { width:8px; height:8px; border-radius:999px; background:var(--cc-color-danger); }.cc-point__section-title { margin:0 -0px -6px; color:var(--cc-ink-900); font-family:var(--cc-font-interface); font-size:15px; }.cc-point__notice { display:flex; gap:10px; padding:14px; border-radius:var(--cc-radius-lg); background:var(--cc-color-mist); }.cc-point__notice p { margin:0; color:var(--cc-ink-600); font-family:var(--cc-font-interface); font-size:13px; line-height:20px; }.cc-point__footer { padding:10px 16px calc(16px + env(safe-area-inset-bottom)); border-top:1px solid var(--cc-divider); background:var(--cc-surface-0); }.cc-point__live { --background:var(--cc-ink-900); color:#fff; }.cc-point__live-header { display:flex; align-items:center; justify-content:space-between; padding:calc(env(safe-area-inset-top) + 10px) 16px 12px; color:#fff; font-family:var(--cc-font-interface); font-size:13px; }.cc-point__live-header button { border:none; background:transparent; padding:8px; }.cc-point__live-body { display:flex; flex-direction:column; align-items:center; min-height:52vh; padding:42px 22px 20px; text-align:center; }.cc-point__live-body h1 { max-width:290px; margin:17px 0 4px; color:#fff; font-family:var(--cc-font-interface); font-size:24px; line-height:31px; }.cc-point__live-body > p { margin:0; color:#b4c2bc; font-family:var(--cc-font-interface); font-size:16px; }.cc-point__speaker { display:flex; flex-direction:column; align-items:center; gap:9px; margin:38px 0; color:#b4c2bc; font-family:var(--cc-font-interface); font-size:15px; }.cc-point__speaker :first-child { display:grid; width:78px; height:78px; place-items:center; border-radius:999px; background:rgba(255,255,255,.09); }.cc-point__attendees { display:flex; justify-content:space-between; width:100%; max-width:350px; }.cc-point__attendees span { display:grid; width:48px; height:48px; place-items:center; border-radius:999px; background:rgba(255,255,255,.13); color:#fff; font-family:var(--cc-font-interface); font-size:12px; font-weight:700; }.cc-point__attendees small { margin-top:62px; color:#b4c2bc; font-size:10px; font-weight:400; white-space:nowrap; }.cc-point__live-controls { display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; padding:12px 16px 22px; }.cc-point__live-controls button { display:flex; min-height:var(--cc-touch-elder); flex-direction:column; align-items:center; justify-content:center; gap:5px; border:none; border-radius:999px; background:rgba(255,255,255,.14); color:#fff; font-family:var(--cc-font-interface); font-size:11px; cursor:pointer; }.cc-point__leave { margin:0 16px calc(16px + env(safe-area-inset-bottom)); width:calc(100% - 32px); }.cc-point__leave:deep(.cc-btn) { border-color:rgba(255,255,255,.35); background:transparent; color:#fff; }
</style>
