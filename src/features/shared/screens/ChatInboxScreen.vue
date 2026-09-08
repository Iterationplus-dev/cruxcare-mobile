<template>
  <ion-page>
    <AppHeader title="Messages" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['chat', 'threads']]" />
      <p class="cc-chat__disclaimer cc-text-caption">
        For care coordination only — call emergency services for urgent medical needs.
      </p>
      <LoadingState v-if="isPending" label="Loading conversations…" />
      <EmptyState
        v-else-if="!threads?.length"
        icon="forum"
        title="No conversations yet"
        :message="emptyMessage"
      />
      <AppCard v-else style="margin: 0 16px; padding: 0">
        <AppListRow
          v-for="t in threads"
          :key="t.id"
          :title="t.participantName"
          :subtitle="t.lastMessage ?? 'No messages yet'"
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
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { AppBadge, AppCard, AppHeader, AppListRow } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { useChatThreads } from '@/composables/useChat';
import { useAuthStore } from '@/stores/auth';

/** D4 inbox (also backs SH2 and CD5) — one thread list shared across contexts. */
const router = useRouter();
const auth = useAuthStore();
const { data: threads, isPending } = useChatThreads();

/** One inbox serves both contexts, so it must not tell a therapist their
 *  messages are with their therapist. */
const emptyMessage = computed(() =>
  auth.activeRole === 'therapist'
    ? 'Messages with your clients will appear here.'
    : 'Messages with your therapist will appear here.',
);
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
