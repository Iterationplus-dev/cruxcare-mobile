<template>
  <ion-page>
    <AppHeader title="Messages" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['chat', 'threads']]" />
      <p class="cc-chat__disclaimer cc-text-caption">
        For care coordination only — call emergency services for urgent medical needs.
      </p>
      <LoadingState v-if="isPending" label="Loading conversations…" />
      <EmptyState v-else-if="!threads?.length" icon="forum" title="No conversations yet" message="Messages with your therapist will appear here." />
      <AppCard v-else style="margin: 0 16px; padding: 0">
        <AppListRow
          v-for="t in threads"
          :key="t.id"
          :title="otherParticipant(t).name"
          :subtitle="t.lastMessage?.body ?? 'No messages yet'"
          chevron
          clickable
          @click="router.push({ name: 'chat-thread', params: { id: t.id } })"
        >
          <template #trailing>
            <AppBadge v-if="t.unreadCount > 0" :label="String(t.unreadCount)" tone="success" />
          </template>
        </AppListRow>
      </AppCard>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { AppPullToRefresh } from '@/components/ui';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppBadge, AppCard, AppHeader, AppListRow } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { useChatThreads } from '@/composables/useChat';
import { useAuthStore } from '@/stores/auth';
import type { ChatThread } from '@/types/care';

/** D4 inbox (also backs SH2 and CD5) — one thread list shared across contexts. */
const router = useRouter();
const auth = useAuthStore();
const { data: threads, isPending } = useChatThreads();

function otherParticipant(t: ChatThread) {
  return t.participants.find((p) => p.id !== auth.user?.id) ?? t.participants[0];
}
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-chat__disclaimer {
  padding: 12px 16px;
  margin: 0;
  text-align: center;
}
</style>
