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
import { formatMoney } from '@/utils/money';

/**
 * The ONLY place money renders. `value` must come straight from an API
 * response — this component formats (locale/currency/sign), it never
 * computes a fee, balance or interest figure. See README "Money rules".
 *
 * `currency` should always be passed from the response that carried the
 * amount. The USD default only covers the handful of fixed-price literals in
 * the UI; it is not a claim about what any given user is charged.
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

const formatted = computed(() =>
  formatMoney(props.value, props.currency, { showSign: props.showSign }),
);

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
