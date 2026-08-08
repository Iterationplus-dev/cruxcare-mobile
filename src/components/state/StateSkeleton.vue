<template>
  <div
    class="cc-skeleton"
    :style="{ width, height, borderRadius: radius }"
    role="presentation"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
/** N1 loading primitive — shimmer block sized to mirror the real layout it stands in for. */
withDefaults(
  defineProps<{ width?: string; height?: string; radius?: string }>(),
  { width: '100%', height: '16px', radius: '6px' },
);
</script>

<style scoped>
.cc-skeleton {
  background: linear-gradient(90deg, #eaf3f0 25%, #f7faf9 37%, #eaf3f0 63%);
  background-size: 320px 100%;
  animation: cc-shimmer 1.3s linear infinite;
}
@keyframes cc-shimmer {
  0% {
    background-position: -320px 0;
  }
  100% {
    background-position: 320px 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cc-skeleton {
    animation: none;
    background: #eaf3f0;
  }
}
</style>
