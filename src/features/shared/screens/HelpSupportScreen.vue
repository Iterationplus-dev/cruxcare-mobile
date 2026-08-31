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
              <div class="cc-text-body-strong cc-contact__title">Message support</div>
              <p class="cc-contact__description">
                Tell us what is going on and our care team will pick it up.
              </p>
            </div>
          </div>

          <AppSheetSelect
            v-model="category"
            label="What is this about?"
            :options="categoryOptions"
          />

          <label class="cc-contact__label" :for="messageId">Your message</label>
          <textarea
            :id="messageId"
            v-model="message"
            class="cc-contact__textarea"
            rows="6"
            :maxlength="MAX_MESSAGE"
            placeholder="Describe what happened, and anything you have already tried."
            :aria-describedby="`${messageId}-count`"
          ></textarea>
          <div class="cc-contact__meta">
            <span v-if="messageError" class="cc-contact__error" role="alert">{{ messageError }}</span>
            <span v-else></span>
            <span :id="`${messageId}-count`" class="cc-contact__count">
              {{ message.length }}/{{ MAX_MESSAGE }}
            </span>
          </div>

          <div class="cc-contact__response-time">
            <AppIcon name="schedule" :size="16" color="var(--cc-ink-600)" />
            <span>Typical reply within a few hours</span>
          </div>
          <AppButton icon="send" :loading="sending" :disabled="!canSend" @click="onSend">
            Send to support
          </AppButton>
        </AppCard>

        <!-- Sent messages, so "did that go through?" has an answer on the
             screen. The button used to toast "Support request queued." and
             send nothing at all. -->
        <template v-if="tickets.length">
          <div class="cc-text-body-strong" style="font-size: 14.5px">Your messages</div>
          <AppCard v-for="t in tickets" :key="t.id" class="cc-ticket">
            <div class="cc-ticket__head">
              <span class="cc-text-mono cc-ticket__ref">{{ t.reference }}</span>
              <AppBadge :label="t.status.toUpperCase()" :tone="statusTone(t.status)" />
            </div>
            <p class="cc-ticket__message">{{ t.message }}</p>
            <div class="cc-ticket__foot">{{ t.category }} · {{ formatSent(t.createdAt) }}</div>
            <div v-if="t.reply" class="cc-ticket__reply">
              <span class="cc-ticket__reply-label">Support replied</span>
              <p>{{ t.reply }}</p>
            </div>
          </AppCard>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  AppBadge,
  AppButton,
  AppCard,
  AppHeader,
  AppIcon,
  AppListRow,
  AppSheetSelect,
} from '@/components/ui';
import { useToast } from '@/composables/useToast';
import { supportApi } from '@/api/support.api';
import { supportCategories, type SupportTicketCategory } from '@/types/support';
import { ApiError } from '@/types/api';

/** SH4/SH5 lean merge — self-serve FAQ above the human channel. */
const toast = useToast();
const queryClient = useQueryClient();
const messageId = `cc-support-${useId()}`;

const MIN_MESSAGE = 10;
const MAX_MESSAGE = 2000;

const expanded = ref('');
const faqs = [
  { q: 'How do I book a therapist?', a: 'Go to Care, choose a therapist, and pick a slot from Book a visit.' },
  { q: 'How do withdrawals work?', a: 'Withdrawals ship with the Finance module — a minimum 5% fee is disclosed before you confirm.' },
  {
    q: 'Is my health data private?',
    // Corrected: acceptance used to open the record on its own. A therapist
    // now has to ask, and the client decides — so the old answer ("only while
    // you have an active booking") described a rule that no longer holds.
    a: 'Yes. A therapist has to ask before they can see your health profile, and you choose whether to allow it. You can withdraw that at any time from Security and privacy.',
  },
];

const category = ref<SupportTicketCategory>(supportCategories[0]);
const categoryOptions = supportCategories.map((c) => ({ value: c, label: c }));
const message = ref('');
const sending = ref(false);
const touched = ref(false);

const trimmed = computed(() => message.value.trim());
const canSend = computed(() => trimmed.value.length >= MIN_MESSAGE);
const messageError = computed(() => {
  if (!touched.value || canSend.value) return '';
  return trimmed.value.length === 0
    ? 'Tell us what you need help with.'
    : 'Please add a little more detail so support can help.';
});

const { data: ticketPage } = useQuery({
  queryKey: ['support', 'tickets'],
  queryFn: () => supportApi.list(),
});
const tickets = computed(() => ticketPage.value?.data ?? []);

function statusTone(status: string): 'success' | 'warning' | 'default' {
  if (status === 'Solved' || status === 'Closed') return 'success';
  if (status === 'Pending') return 'warning';
  return 'default';
}

function formatSent(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function onSend() {
  touched.value = true;
  if (!canSend.value) return;

  sending.value = true;
  try {
    const ticket = await supportApi.send({
      message: trimmed.value,
      category: category.value,
    });
    message.value = '';
    touched.value = false;
    await queryClient.invalidateQueries({ queryKey: ['support', 'tickets'] });
    // The reference is the point: it is what a person quotes back, and the
    // old success toast gave them nothing to quote.
    await toast.show(`Support has your message. Reference ${ticket.reference}.`, 'success', {
      title: 'Message sent',
    });
  } catch (error) {
    const message_ =
      error instanceof ApiError
        ? error.message
        : 'We could not send your message. Check your connection and try again.';
    await toast.show(message_, 'danger', { title: 'Not sent' });
  } finally {
    sending.value = false;
  }
}
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
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: var(--cc-surface-tint);
}
.cc-contact__body {
  flex: 1;
}
.cc-contact__title {
  font-size: 15px;
}
.cc-contact__description {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cc-ink-600);
}
.cc-contact__label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--cc-ink-700);
}
.cc-contact__textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid var(--cc-line);
  border-radius: 10px;
  background: var(--cc-surface-card);
  color: var(--cc-ink-900);
  font: inherit;
  font-size: 14.5px;
  line-height: 1.5;
  resize: vertical;
}
.cc-contact__textarea:focus-visible {
  outline: 3px solid rgba(14, 124, 107, 0.35);
  outline-offset: 1px;
  border-color: var(--cc-color-primary);
}
.cc-contact__meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: -6px;
}
.cc-contact__error {
  font-size: 12.5px;
  color: var(--cc-color-danger);
}
.cc-contact__count {
  font-size: 12px;
  color: var(--cc-ink-400);
  font-variant-numeric: tabular-nums;
}
.cc-contact__response-time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: var(--cc-ink-600);
}
.cc-ticket {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cc-ticket__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.cc-ticket__ref {
  font-size: 11.5px;
  color: var(--cc-ink-400);
}
.cc-ticket__message {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--cc-ink-900);
}
.cc-ticket__foot {
  font-size: 12px;
  color: var(--cc-ink-400);
}
.cc-ticket__reply {
  border-left: 3px solid var(--cc-color-primary);
  padding: 8px 0 8px 12px;
}
.cc-ticket__reply-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--cc-color-primary);
}
.cc-ticket__reply p {
  margin: 4px 0 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--cc-ink-900);
}
</style>
