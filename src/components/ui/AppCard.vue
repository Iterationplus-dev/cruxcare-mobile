<template>
  <div class="cc-card" :class="{ 'cc-card--tinted': tint }">
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ tint?: boolean }>(), { tint: false });
</script>

<style scoped>
.cc-card {
  background: var(--cc-surface-0);
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-lg);
  padding: var(--cc-card-padding-max) var(--cc-card-padding-min);
}
.cc-card--tinted {
  background: var(--cc-color-mist);
  border-color: transparent;
}
</style>
