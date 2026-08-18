<template>
  <ion-page>
    <ion-header class="cc-thread-header">
      <ion-toolbar class="cc-thread-header__bar">
        <ion-buttons slot="start">
          <ion-back-button default-href="/tabs/care" text="" />
        </ion-buttons>
        <div class="cc-thread-header__title">
          <AppAvatar :name="other?.name ?? ''" :size="36" />
          <div>
            <div class="cc-text-body-strong" style="font-size: 16px">{{ other?.name }}</div>
            <div v-if="other?.online" class="cc-thread-header__online">
              <span class="cc-thread-header__dot" /> Online
            </div>
          </div>
        </div>
        <ion-buttons slot="end">
          <button type="button" class="cc-thread-header__video" aria-label="Start video" @click="goVideo">
            <AppIcon name="videocam" :size="24" color="var(--cc-color-primary)" />
          </button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['chat', 'threads']]" />
      <LoadingState v-if="isPending" label="Loading messages…" />
      <div v-else class="cc-thread__messages">
        <div
          v-for="m in messages"
          :key="m.id"
          class="cc-bubble"
          :class="{ 'cc-bubble--mine': m.senderId === auth.user?.id }"
        >
          <div class="cc-bubble__body">{{ m.body }}</div>
          <div class="cc-bubble__meta">{{ formatTime(m.sentAt) }}</div>
        </div>
      </div>
    </ion-content>
    <div class="cc-thread__composer">
      <button type="button" class="cc-thread__attach" aria-label="Attach file">
        <AppIcon name="attach_file" :size="22" color="var(--cc-ink-600)" />
      </button>
      <input v-model="draft" type="text" placeholder="Message" @keyup.enter="send" />
      <button type="button" class="cc-thread__send" aria-label="Send" :disabled="!draft.trim()" @click="send">
        <AppIcon name="send" :size="22" color="#fff" />
      </button>
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import { AppPullToRefresh } from '@/components/ui';
import { computed, ref } from 'vue';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonToolbar,
} from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppAvatar, AppIcon } from '@/components/ui';
import { LoadingState } from '@/components/state';
import { useChatMessages, useChatThreads, useSendMessage } from '@/composables/useChat';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const threadId = route.params.id as string;

const { data: threads } = useChatThreads();
const other = computed(() => {
  const thread = threads.value?.find((t) => t.id === threadId);
  return thread?.participants.find((p) => p.id !== auth.user?.id);
});

const { data: messagesPage, isPending } = useChatMessages(threadId);
const messages = computed(() => messagesPage.value?.data ?? []);

const draft = ref('');
const sendMutation = useSendMessage(threadId);

function send() {
  if (!draft.value.trim()) return;
  sendMutation.mutate(draft.value.trim());
  draft.value = '';
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function goVideo() {
  router.push({ name: 'video-visit', params: { id: threadId } });
}
</script>

<style scoped>
.cc-thread-header {
  box-shadow: none;
}
.cc-thread-header__bar {
  --background: var(--cc-surface-0);
  --border-color: var(--cc-divider);
}
.cc-thread-header__title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}
.cc-thread-header__online {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  color: var(--cc-color-success-text);
}
.cc-thread-header__dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--cc-color-success);
}
.cc-thread-header__video {
  background: none;
  border: none;
  display: flex;
  cursor: pointer;
}
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-thread__messages {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cc-bubble {
  align-self: flex-start;
  max-width: 78%;
  background: var(--cc-surface-0);
  border: 1px solid var(--cc-line);
  border-radius: 16px 16px 16px 4px;
  padding: 12px 14px;
}
.cc-bubble--mine {
  align-self: flex-end;
  background: var(--cc-color-primary);
  border: none;
  border-radius: 16px 16px 4px 16px;
  color: #fff;
}
.cc-bubble__body {
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 19px;
}
.cc-bubble__meta {
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  margin-top: 4px;
  opacity: 0.75;
}
.cc-thread__composer {
  background: var(--cc-surface-0);
  border-top: 1px solid var(--cc-line);
  padding: 10px 12px calc(16px + env(safe-area-inset-bottom));
  display: flex;
  gap: 8px;
  align-items: center;
}
.cc-thread__attach {
  width: 44px;
  height: 44px;
  border-radius: var(--cc-radius-md);
  background: var(--cc-surface-app);
  border: none;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.cc-thread__composer input {
  flex: 1;
  height: 44px;
  border-radius: 999px;
  background: var(--cc-surface-app);
  border: 1px solid var(--cc-line);
  padding: 0 14px;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
}
.cc-thread__send {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  background: var(--cc-color-primary);
  border: none;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.cc-thread__send:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
