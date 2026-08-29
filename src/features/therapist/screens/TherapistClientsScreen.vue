<template>
  <ion-page>
    <AppHeader title="Clients" :botanical="false" />
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['case-files']]" />
      <LoadingState v-if="isPending" label="Loading your clients…" />
      <EmptyState v-else-if="!caseFiles?.data.length" icon="groups" title="No clients yet" message="Clients assigned to you will appear here." />
      <template v-else>
        <!-- TD4's three filters. Needs follow-up is a subset of Active rather
             than a separate bucket, so a client waiting on a note is counted
             in both — which is what the design shows. -->
        <div class="cc-clients__filters" role="tablist" aria-label="Filter clients">
          <button
            v-for="f in CLIENT_FILTERS"
            :key="f.value"
            type="button"
            role="tab"
            class="cc-clients__filter"
            :class="{ 'cc-clients__filter--on': filter === f.value }"
            :aria-selected="filter === f.value"
            @click="filter = f.value"
          >
            {{ f.label }} {{ countFor(caseFiles.data, f.value) }}
          </button>
        </div>

        <EmptyState
          v-if="!visible.length"
          icon="groups"
          :title="emptyTitle"
          :message="emptyMessage"
        />
        <AppCard v-else style="margin: 16px; padding: 0">
        <AppListRow
          v-for="cf in visible"
          :key="cf.id"
          :title="cf.clientName || 'CruxCare client'"
          :subtitle="presentClientRow(cf).subtitle"
          :subtitle-tone="presentClientRow(cf).tone === 'attention' ? 'warning' : undefined"
          icon="folder_shared"
          :icon-color="presentClientRow(cf).tone === 'attention' ? 'var(--cc-color-warning)' : 'var(--cc-color-primary)'"
          chevron
          clickable
          @click="router.push({ name: 'case-file', params: { id: cf.id } })"
        />
        </AppCard>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { AppPullToRefresh } from '@/components/ui';
import { IonContent, IonPage } from '@ionic/vue';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AppCard, AppHeader, AppListRow } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { useCaseFiles } from '@/composables/useCaseFiles';
import { presentClientRow } from '@/features/therapist/clientListPresentation';
import {
  CLIENT_FILTERS,
  countFor,
  filterClients,
  type ClientFilter,
} from '@/features/therapist/clientListFilters';

/** TD4 · Client management — list plus record in one view, unwritten notes flagged. */
const router = useRouter();
const { data: caseFiles, isPending } = useCaseFiles();

const filter = ref<ClientFilter>('active');
const visible = computed(() => filterClients(caseFiles.value?.data, filter.value));

const emptyTitle = computed(() =>
  filter.value === 'needs-follow-up' ? 'Nothing waiting' : 'No clients here',
);
const emptyMessage = computed(() => {
  if (filter.value === 'needs-follow-up') return 'No client is waiting on a note or a next session.';
  if (filter.value === 'past') return 'Clients whose care has ended will appear here.';
  return 'Clients you are currently working with will appear here.';
});
</script>

<style scoped>
.cc-clients__filters {
  display: flex;
  gap: 8px;
  padding: 12px 16px 0;
  overflow-x: auto;
}
.cc-clients__filter {
  flex: none;
  padding: 8px 14px;
  border-radius: var(--cc-radius-pill);
  border: 1px solid var(--cc-line);
  background: var(--cc-surface-0);
  font-family: var(--cc-font-interface);
  font-size: 13px;
  font-weight: 600;
  color: var(--cc-ink-600);
  cursor: pointer;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.cc-clients__filter--on {
  background: var(--cc-color-primary);
  border-color: var(--cc-color-primary);
  color: #fff;
}
.cc-screen {
  --background: var(--cc-surface-app);
}
</style>
