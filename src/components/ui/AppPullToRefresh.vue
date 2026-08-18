<template>
  <ion-refresher slot="fixed" @ionRefresh="handleRefresh">
    <ion-refresher-content
      pulling-text="Pull to refresh"
      refreshing-spinner="crescent"
    />
  </ion-refresher>
</template>

<script setup lang="ts">
import { IonRefresher, IonRefresherContent } from '@ionic/vue';
import { useQueryClient, type QueryKey } from '@tanstack/vue-query';

const props = defineProps<{
  queryKeys: QueryKey[];
  refresh?: () => Promise<unknown> | unknown;
}>();

const queryClient = useQueryClient();

async function handleRefresh(event: Event) {
  try {
    const tasks: Promise<unknown>[] = props.queryKeys.map((queryKey) =>
      queryClient.refetchQueries({ queryKey, type: 'active' }),
    );
    if (props.refresh) tasks.push(Promise.resolve(props.refresh()));
    await Promise.all(tasks);
  } finally {
    await (event.target as HTMLIonRefresherElement).complete();
  }
}
</script>