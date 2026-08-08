<template>
  <div class="cc-error-state">
    <div class="cc-error-state__banner">
      <AppIcon name="error" :size="22" color="#8E2E27" />
      <div>
        <div class="cc-error-state__title">{{ title }}</div>
        <div class="cc-error-state__message">{{ message }}</div>
      </div>
    </div>

    <AppCard v-if="kept.length" class="cc-error-state__card">
      <div class="cc-error-state__card-heading">What you asked for is kept</div>
      <div class="cc-error-state__rows">
        <div v-for="row in kept" :key="row.label" class="cc-error-state__row">
          <span class="cc-text-subtitle">{{ row.label }}</span>
          <span class="cc-text-mono">{{ row.value }}</span>
        </div>
      </div>
    </AppCard>

    <AppCard class="cc-error-state__card cc-error-state__card--grow">
      <div class="cc-error-state__card-heading">What you can do</div>
      <div class="cc-error-state__options">
        <div v-for="opt in options" :key="opt.label" class="cc-error-state__option">
          <AppIcon :name="opt.icon" :size="18" color="var(--cc-color-primary)" />
          <span class="cc-text-body">{{ opt.label }}</span>
        </div>
      </div>
      <div v-if="reference" class="cc-error-state__reference">
        <span class="cc-text-caption">Reference</span>
        <span class="cc-text-mono">{{ reference }}</span>
      </div>
    </AppCard>

    <div class="cc-error-state__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import AppCard from '../ui/AppCard.vue';
import AppIcon from '../ui/AppIcon.vue';

/**
 * N4 — money-action error. States plainly what did NOT happen, keeps the
 * entered input visible (`kept`), and gives a reference tied to the failed
 * quote/attempt so support can trace it. Actions (Try again / Contact
 * support) are passed in via the `actions` slot so the caller owns retry
 * semantics — a retry here must re-quote, never resubmit blindly.
 */
withDefaults(
  defineProps<{
    title: string;
    message: string;
    kept?: { label: string; value: string }[];
    options?: { icon: string; label: string }[];
    reference?: string;
  }>(),
  { kept: () => [], options: () => [] },
);
</script>

<style scoped>
.cc-error-state {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cc-error-state__banner {
  background: #fbe9e7;
  border: 1px solid #efc4bf;
  border-radius: var(--cc-radius-lg);
  padding: 16px;
  display: flex;
  gap: 12px;
}
.cc-error-state__title {
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 14px;
  line-height: 20px;
  color: #5e1f1a;
  margin-bottom: 4px;
}
.cc-error-state__message {
  font-family: var(--cc-font-interface);
  font-size: 13px;
  line-height: 20px;
  color: #8e2e27;
}
.cc-error-state__card-heading {
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 13px;
  line-height: 19px;
  margin-bottom: 12px;
}
.cc-error-state__card--grow {
  flex: 1;
}
.cc-error-state__rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cc-error-state__row {
  display: flex;
  justify-content: space-between;
}
.cc-error-state__options {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.cc-error-state__option {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.cc-error-state__reference {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--cc-divider);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
