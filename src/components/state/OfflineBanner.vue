<template>
  <div class="cc-offline-banner" role="status">
    <AppIcon name="cloud_off" :size="20" color="#8A4E17" />
    <div class="cc-offline-banner__body">
      <div class="cc-offline-banner__title">You're offline</div>
      <div class="cc-offline-banner__message">
        Showing what we saved at {{ lastSavedAt }}. Money actions are paused until you reconnect.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '../ui/AppIcon.vue';

/** N3 — cached values stay visible but stamped with when they were saved. */
defineProps<{ lastSavedAt: string }>();
</script>

<style scoped>
.cc-offline-banner {
  background: #fbeee2;
  border: 1px solid #e8c9a6;
  border-radius: var(--cc-radius-lg);
  padding: 14px;
  display: flex;
  gap: 10px;
}
.cc-offline-banner__title {
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 13px;
  line-height: 19px;
  color: #5e3810;
}
.cc-offline-banner__message {
  font-family: var(--cc-font-interface);
  font-size: 11px;
  line-height: 16px;
  color: #8a4e17;
}
</style>
