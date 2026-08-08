<template>
  <AppCard class="cc-stat">
    <AppIcon :name="icon" :size="20" color="var(--cc-color-primary)" />
    <div class="cc-stat__label cc-text-caption">{{ label }}</div>
    <div class="cc-stat__value cc-text-h2">
      <slot>{{ value }}</slot>
    </div>
  </AppCard>
</template>

<script setup lang="ts">
import AppCard from './AppCard.vue';
import AppIcon from './AppIcon.vue';

defineProps<{ icon: string; label: string; value?: string }>();
</script>

<style scoped>
.cc-stat {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cc-stat__label {
  margin: 0;
}
.cc-stat__value {
  margin: 0;
}
</style>
