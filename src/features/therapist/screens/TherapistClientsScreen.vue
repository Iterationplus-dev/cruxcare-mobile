<template>
  <ion-page>
    <AppHeader title="Clients" :botanical="false" />
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['case-files']]" />
      <LoadingState v-if="isPending" label="Loading your clients…" />

      <!-- A failed load is not an empty caseload, and must never be drawn as
           one. `GET /case-files` answering 500 left this screen telling a
           therapist with five open case files that they had no clients — a
           confident false statement about their own work, with no hint that
           anything had gone wrong and nothing to retry. -->
      <ErrorState
        v-else-if="loadFailed"
        title="We could not load your clients"
        message="Your case files are safe. Check your connection and try again."
      >
        <template #actions>
          <AppButton variant="secondary" @click="refetch()">Try again</AppButton>
        </template>
      </ErrorState>

      <!-- Only when the therapist has nobody at all — a tab that happens to be
           empty is a different message, handled below the chips. -->
      <EmptyState
        v-else-if="!hasAnyClients"
        icon="groups"
        title="No clients yet"
        message="Clients assigned to you will appear here."
      />
      <template v-else>
        <div class="cc-clients__search">
          <AppInput v-model="query" placeholder="Search clients by name" />
        </div>

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
            {{ f.label }} {{ counts?.[f.countKey] ?? 0 }}
          </button>
        </div>

        <EmptyState
          v-if="!rows.length"
          icon="groups"
          :title="emptyTitle"
          :message="emptyMessage"
        />
        <AppCard v-else class="cc-clients__list">
          <!-- One presentation per row rather than three calls in the
               template: it reads the clock, so calling it repeatedly can put
               two different times on one row. -->
          <AppListRow
            v-for="row in presentedRows"
            :key="row.id"
            :title="row.name"
            :subtitle="row.subtitle"
            :subtitle-tone="row.needsAttention ? 'warning' : undefined"
            clickable
            :divider="row.id !== presentedRows[presentedRows.length - 1].id"
            @click="router.push({ name: 'case-file', params: { id: row.id } })"
          >
            <!-- A person, not a folder. Five identical folder glyphs gave the
                 eye nothing to aim at; initials are the thing a therapist
                 actually scans a caseload by. -->
            <template #leading>
              <AppAvatar :name="row.name" :size="38" />
            </template>

            <!-- Chevron kept alongside the badge: the badge says the row wants
                 something, the chevron says the row opens. Colour alone would
                 carry the first for nobody who cannot see orange. -->
            <template #trailing>
              <span class="cc-clients__meta">
                <AppBadge v-if="row.needsAttention" label="NOTE DUE" tone="warning" />
                <AppIcon name="chevron_right" :size="20" color="var(--cc-ink-400)" />
              </span>
            </template>
          </AppListRow>
        </AppCard>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { AppPullToRefresh } from '@/components/ui';
import { IonContent, IonPage } from '@ionic/vue';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { AppAvatar, AppBadge, AppButton, AppCard, AppHeader, AppIcon, AppListRow } from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/state';
import { AppInput } from '@/components/ui';
import { useCaseFiles } from '@/composables/useCaseFiles';
import { presentClientRow } from '@/features/therapist/clientListPresentation';
import { CLIENT_FILTERS, type ClientFilter } from '@/features/therapist/clientListFilters';

/** TD4 · Client management — list plus record in one view, unwritten notes flagged. */
const router = useRouter();
const filter = ref<ClientFilter>('active');
const query = ref('');

/** Debounced so a search does not fire a request per keystroke. */
const debouncedQuery = ref('');
let queryTimer: ReturnType<typeof setTimeout> | undefined;
watch(query, (next) => {
  clearTimeout(queryTimer);
  queryTimer = setTimeout(() => {
    debouncedQuery.value = next;
  }, 250);
});

const {
  data: caseFiles,
  isPending,
  isError,
  refetch,
} = useCaseFiles(computed(() => ({ state: filter.value, q: debouncedQuery.value })));

/**
 * A failure with nothing to fall back on.
 *
 * Gated on there being no data rather than on `isError` alone: a background
 * refetch that fails still has the last good list in hand, and replacing a
 * therapist's caseload with a full-screen error because one poll failed is a
 * worse lie than the stale row count. Only a first load with nothing to show
 * gets the error screen.
 */
const loadFailed = computed(() => isError.value && !caseFiles.value);

const rows = computed(() => caseFiles.value?.data ?? []);

/**
 * Each row, presented once.
 *
 * `presentClientRow` reads the clock, so calling it from three places in the
 * template is three different readings of "now" on one row — enough, at a
 * minute boundary, to render a subtitle that disagrees with its own tone.
 */
const presentedRows = computed(() =>
  rows.value.map((cf) => {
    const presented = presentClientRow(cf);
    return {
      id: cf.id,
      name: cf.clientName || 'CruxCare client',
      subtitle: presented.subtitle,
      needsAttention: presented.tone === 'attention',
    };
  }),
);
/** Totals over everything the therapist can see, not the loaded page. */
const counts = computed(() => caseFiles.value?.meta?.counts);

const hasAnyClients = computed(() => {
  const c = counts.value;
  // Before the first response there is nothing to say either way; showing the
  // list shell beats flashing "no clients yet" at someone who has some.
  if (!c) return true;
  return c.active + c.past > 0;
});

const emptyTitle = computed(() => {
  if (query.value.trim()) return 'No match';
  return filter.value === 'needs-follow-up' ? 'Nothing waiting' : 'No clients here';
});
const emptyMessage = computed(() => {
  // A search that finds nothing is a different situation from an empty tab,
  // and saying so stops it reading as "you have no clients".
  if (query.value.trim()) return `No client here matches “${query.value.trim()}”.`;
  if (filter.value === 'needs-follow-up') return 'No client is waiting on a note or a next session.';
  if (filter.value === 'past') return 'Clients whose care has ended will appear here.';
  return 'Clients you are currently working with will appear here.';
});
</script>

<style scoped>
.cc-clients__list {
  margin: 16px;
  padding: 0;
  overflow: hidden;
}
/* Badge and chevron as one trailing unit, so the chevrons stay in a column
   down the list whether or not a row carries a badge. */
.cc-clients__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cc-clients__search {
  padding: 12px 16px 0;
}
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
