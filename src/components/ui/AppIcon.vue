<template>
  <span
    class="material-symbols-rounded cc-icon"
    :style="{ fontSize: `${size}px`, color: color, fontVariationSettings: variationSettings }"
    aria-hidden="true"
    >{{ name }}</span
  >
</template>

<script setup lang="ts">
import { computed } from 'vue';

/**
 * Wraps the self-hosted Material Symbols Rounded font (24opsz/400/unfilled
 * per the design system) so screens reference icons by name instead of
 * touching the font directly.
 */
const props = withDefaults(
  defineProps<{
    name: string;
    /** README specifies 16/20/22/24/48 as the core scale, but exact pixel
     * values recur throughout the screens (14, 26, 46...) — kept as a plain
     * number rather than re-litigating the union on every new size. */
    size?: number;
    color?: string;
    filled?: boolean;
  }>(),
  {
    size: 24,
    color: 'currentColor',
    filled: false,
  },
);

const variationSettings = computed(
  () => `'FILL' ${props.filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
);
</script>

<style scoped>
/**
 * Both classes on purpose. A screen rule like `.card span { font-family: … }`
 * outranks a single class, and since this root is a <span> holding the icon
 * name as a ligature, losing the icon face renders that name as words —
 * "check_circle" in prose rather than a tick. Two classes outrank any
 * `.class element` selector, so the icon keeps its face and box regardless.
 */
.cc-icon.material-symbols-rounded {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: 'Material Symbols Rounded';
  line-height: 1;
}
</style>
