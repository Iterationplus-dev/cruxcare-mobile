<template>
  <div class="cc-section-label">{{ label }}</div>
</template>

<script setup lang="ts">
/**
 * The uppercase mono heading the profile screens group rows under —
 * "VERIFIED DETAILS", "SIGNING IN", "ALWAYS SENT".
 *
 * A component rather than a repeated inline style: it appears a dozen times
 * across PR1–PR6, and the design treats it as one thing.
 */
defineProps<{ label: string }>();
</script>

<style scoped>
.cc-section-label {
  font-family: var(--cc-font-mono);
  font-size: 11.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--cc-ink-400);
  margin: 6px 0 -4px;
}
</style>
