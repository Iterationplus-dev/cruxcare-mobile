<template>
  <ion-page>
    <AppHeader title="Help and support" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <AppCard style="padding: 0">
          <AppListRow
            v-for="f in faqs"
            :key="f.q"
            :title="f.q"
            :subtitle="expanded === f.q ? f.a : undefined"
            :icon="expanded === f.q ? 'expand_less' : 'expand_more'"
            icon-color="var(--cc-ink-400)"
            clickable
            @click="expanded = expanded === f.q ? '' : f.q"
          />
        </AppCard>

        <div class="cc-text-body-strong" style="font-size: 14.5px">Still need help?</div>
        <AppCard class="cc-contact">
          <div class="cc-contact__intro">
            <div class="cc-contact__icon" aria-hidden="true">
              <AppIcon name="support_agent" :size="24" color="var(--cc-color-primary)" />
            </div>
            <div class="cc-contact__body">
              <div class="cc-text-body-strong cc-contact__title">Contact support</div>
              <p class="cc-contact__description">Our care team is here to help with your account, bookings, and orders.</p>
            </div>
          </div>
          <div class="cc-contact__response-time">
            <AppIcon name="schedule" :size="16" color="var(--cc-ink-600)" />
            <span>Typical reply within a few hours</span>
          </div>
          <AppButton icon="chat" @click="toast.show('Support request queued.', 'success')">Message support</AppButton>
        </AppCard>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { AppButton, AppCard, AppHeader, AppIcon, AppListRow } from '@/components/ui';
import { useToast } from '@/composables/useToast';

/** SH4/SH5 lean merge — self-serve FAQ above the human channel. */
const toast = useToast();
const expanded = ref('');
const faqs = [
  { q: 'How do I book a therapist?', a: 'Go to Care, choose a therapist, and pick a slot from Book a visit.' },
  { q: 'How do withdrawals work?', a: 'Withdrawals ship with the Finance module — a minimum 5% fee is disclosed before you confirm.' },
  { q: 'Is my health data private?', a: 'Only your assigned therapist and authorised admins can see it, and only while you have an active booking.' },
];
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cc-contact {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: stretch;
}
.cc-contact__intro {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.cc-contact__icon {
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: var(--cc-radius-md);
  background: var(--cc-color-mist);
}
.cc-contact__body {
  min-width: 0;
  flex: 1;
}
.cc-contact__title {
  font-size: 16px;
  line-height: 22px;
}
.cc-contact__description {
  margin: 3px 0 0;
  color: var(--cc-ink-600);
  font-size: 13.5px;
  line-height: 20px;
}
.cc-contact__response-time {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--cc-ink-600);
  font-size: 13px;
  line-height: 18px;
}
</style>
