<template>
  <ion-page>
    <AppHeader title="Calendar" :botanical="false" />
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['appointments']]" />
      <LoadingState v-if="isPending" label="Loading calendar…" />
      <EmptyState v-else-if="!appointments?.data.length" icon="calendar_month" title="Nothing scheduled" message="Accepted appointments will show up here." />
      <AppCard v-else style="margin: 16px; padding: 0">
        <AppListRow
          v-for="a in appointments.data"
          :key="a.id"
          :title="a.clientName"
          :subtitle="`${formatSlot(a.slot)} · ${a.type}`"
          :icon="a.status === 'requested' ? 'schedule' : 'event_available'"
          :icon-color="a.status === 'requested' ? 'var(--cc-color-warning)' : 'var(--cc-color-primary)'"
          chevron
          clickable
          @click="router.push({ name: 'appointment-management' })"
        />
      </AppCard>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { AppPullToRefresh } from '@/components/ui';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppCard, AppHeader, AppListRow } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { useAppointments } from '@/composables/useAppointments';

const router = useRouter();
const { data: appointments, isPending } = useAppointments();

function formatSlot(iso: string) {
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-app);
}
</style>
