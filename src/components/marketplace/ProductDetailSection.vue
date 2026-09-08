<template>
  <div class="cc-pds">
    <button
      type="button"
      class="cc-pds__head"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="open = !open"
    >
      <span class="cc-text-body">{{ title }}</span>
      <AppIcon
        :name="open ? 'expand_less' : 'expand_more'"
        :size="20"
        color="var(--cc-ink-400)"
      />
    </button>
    <div v-show="open" :id="panelId" class="cc-pds__panel">
      <p v-if="body" class="cc-pds__body">{{ body }}</p>
      <!-- Said rather than hidden: a section the design draws, with nothing
           behind it, is a gap somebody should fill — and a merchandiser only
           learns that if the app admits it. -->
      <p v-else class="cc-pds__empty">{{ emptyLabel }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, useId } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';

/**
 * One collapsible row on C2 — How to use, Ingredients, Delivery & pickup.
 *
 * Collapsed by default, as drawn: the description above answers most visits,
 * and three open panels would bury the price and the add-to-cart button.
 */
withDefaults(
  defineProps<{
    title: string;
    body?: string | null;
    emptyLabel?: string;
  }>(),
  { emptyLabel: 'Not listed for this product yet.' },
);

const open = ref(false);
const panelId = `cc-pds-${useId()}`;
</script>

<style scoped>
.cc-pds {
  border-top: 1px solid var(--cc-line);
}
.cc-pds__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  min-height: 52px;
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  font: inherit;
}
.cc-pds__head:focus-visible {
  outline: 3px solid rgba(14, 124, 107, 0.35);
  outline-offset: -3px;
}
.cc-pds__panel {
  padding-bottom: 14px;
}
.cc-pds__body,
.cc-pds__empty {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.6;
}
.cc-pds__body {
  color: var(--cc-ink-700);
  white-space: pre-line;
}
.cc-pds__empty {
  color: var(--cc-ink-400);
}
</style>
