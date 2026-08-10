<template>
  <div class="cc-lock-notice">
    <AppIcon name="lock" :size="20" color="var(--cc-ink-400)" />
    <p>We don't queue money actions offline. Nothing will happen behind your back.</p>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '../ui/AppIcon.vue';
/** N3 — money writes are disabled offline, never silently queued (README non-negotiable rule). */
</script>

<style scoped>
.cc-lock-notice {
  background: var(--cc-surface-0);
  border: 1px dashed var(--cc-line);
  border-radius: var(--cc-radius-lg);
  padding: 14px;
  display: flex;
  gap: 10px;
}
.cc-lock-notice p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 17px;
  color: var(--cc-ink-600);
}
</style>
