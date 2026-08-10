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
          <AppIcon name="support_agent" :size="22" color="var(--cc-color-primary)" />
          <div class="cc-contact__body">
            <div class="cc-text-body-strong" style="font-size: 14.5px">Contact support</div>
            <div class="cc-text-caption">Typical reply within a few hours</div>
          </div>
          <AppButton variant="secondary" @click="toast.show('Support request queued.', 'success')">Message</AppButton>
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
  gap: 12px;
  align-items: center;
}
.cc-contact__body {
  flex: 1;
}
</style>
