<template>
  <ion-page>
    <AppHeader title="Clients" :botanical="false" />
    <ion-content class="cc-screen">
      <LoadingState v-if="isPending" label="Loading your clients…" />
      <EmptyState v-else-if="!caseFiles?.data.length" icon="groups" title="No clients yet" message="Clients assigned to you will appear here." />
      <AppCard v-else style="margin: 16px; padding: 0">
        <AppListRow
          v-for="cf in caseFiles.data"
          :key="cf.id"
          :title="cf.clientName"
          :subtitle="cf.notes.some((n) => n.draft) ? 'Unwritten notes' : `${cf.sessionCount} session(s)`"
          icon="folder_shared"
          :icon-color="cf.notes.some((n) => n.draft) ? 'var(--cc-color-warning)' : 'var(--cc-color-primary)'"
          chevron
          clickable
          @click="router.push({ name: 'case-file', params: { id: cf.id } })"
        />
      </AppCard>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppCard, AppHeader, AppListRow } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { useCaseFiles } from '@/composables/useCaseFiles';

/** TD4 · Client management — list plus record in one view, unwritten notes flagged. */
const router = useRouter();
const { data: caseFiles, isPending } = useCaseFiles();
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-app);
}
</style>
