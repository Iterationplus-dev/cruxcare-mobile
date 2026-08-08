<template>
  <span
    class="cc-money"
    :class="[`cc-money--${size}`, toneClass]"
    :aria-label="ariaLabel"
  >
    <span aria-hidden="true">{{ formatted }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

/**
 * The ONLY place money renders. `value` must come straight from an API
 * response — this component formats (locale/currency/sign), it never
 * computes a fee, balance or interest figure. See README "Money rules".
 */
const props = withDefaults(
  defineProps<{
    value: number;
    currency?: string;
    size?: 'display' | 'mono';
    showSign?: boolean;
    tone?: 'default' | 'success' | 'danger' | 'warning';
  }>(),
  { currency: 'USD', size: 'mono', showSign: false, tone: 'default' },
);

const formatted = computed(() => {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: props.currency,
    signDisplay: props.showSign ? 'exceptZero' : 'auto',
  });
  return formatter.format(props.value);
});

const ariaLabel = computed(() => `${formatted.value} ${props.currency}`);

const toneClass = computed(() => {
  if (props.tone !== 'default') return `cc-money--${props.tone}`;
  if (props.showSign && props.value > 0) return 'cc-money--success';
  if (props.showSign && props.value < 0) return 'cc-money--danger';
  return '';
});
</script>

<style scoped>
.cc-money {
  font-family: var(--cc-font-mono);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.cc-money--mono {
  font-size: var(--cc-text-mono-size);
  line-height: var(--cc-text-mono-line);
}
.cc-money--display {
  font-size: var(--cc-text-display-size);
  line-height: var(--cc-text-display-line);
  font-weight: 700;
}
.cc-money--success {
  color: var(--cc-color-success-text);
}
.cc-money--danger {
  color: var(--cc-error-surface-text);
}
.cc-money--warning {
  color: var(--cc-color-warning-text);
}
</style>
