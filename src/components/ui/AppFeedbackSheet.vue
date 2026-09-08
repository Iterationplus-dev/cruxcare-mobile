<template>
  <AppSheet
    class="cc-feedback-sheet"
    :model-value="active !== null"
    @update:model-value="onOpenChange"
  >
    <section
      v-if="active"
      class="cc-feedback-sheet__body"
      :class="`cc-feedback-sheet__body--${active.tone}`"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="cc-feedback-sheet-title"
      aria-describedby="cc-feedback-sheet-message"
    >
      <button
        ref="closeButton"
        type="button"
        class="cc-feedback-sheet__close"
        aria-label="Dismiss message"
        @click="dismiss"
      >
        <AppIcon name="close" :size="24" color="var(--cc-ink-600)" />
      </button>

      <div class="cc-feedback-sheet__icon" aria-hidden="true">
        <AppIcon :name="icon" :size="34" />
      </div>

      <h2 id="cc-feedback-sheet-title" class="cc-feedback-sheet__title">{{ active.title }}</h2>
      <p id="cc-feedback-sheet-message" class="cc-feedback-sheet__message">{{ active.message }}</p>

      <!-- Only a server failure carries one. It is the single thing on this
           sheet worth reading out, so it is selectable rather than decorative. -->
      <p v-if="active.reference" class="cc-feedback-sheet__reference">
        Quote reference
        <span class="cc-feedback-sheet__code">{{ active.reference }}</span>
      </p>

      <AppButton class="cc-feedback-sheet__action" @click="dismiss">
        {{ active.dismissLabel }}
      </AppButton>
    </section>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import AppButton from './AppButton.vue';
import AppIcon from './AppIcon.vue';
import AppSheet from './AppSheet.vue';

const { active, dismiss } = useToast();
const closeButton = ref<HTMLButtonElement>();

const icon = computed(() => {
  switch (active.value?.tone) {
    case 'success':
      return 'check_circle';
    case 'warning':
      return 'warning';
    case 'danger':
      return 'error';
    default:
      return 'info';
  }
});

watch(active, async (feedback) => {
  if (!feedback) return;
  await nextTick();
  closeButton.value?.focus();
});

function onOpenChange(open: boolean) {
  if (!open) dismiss();
}
</script>

<style>
/* The modal host is teleported by Ionic, so this style must remain global. */
.cc-feedback-sheet::part(content) {
  box-shadow: var(--cc-elevation-2);
}
.cc-feedback-sheet::part(backdrop) {
  background: rgba(26, 43, 34, 0.58);
  opacity: 1;
}
</style>

<style scoped>
.cc-feedback-sheet__body {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px var(--cc-space-6) calc(var(--cc-space-5) + env(safe-area-inset-bottom));
  text-align: center;
}
.cc-feedback-sheet__close {
  position: absolute;
  top: 0;
  right: var(--cc-space-2);
  display: grid;
  width: var(--cc-touch-min);
  height: var(--cc-touch-min);
  place-items: center;
  border: 0;
  border-radius: var(--cc-radius-pill);
  background: transparent;
  cursor: pointer;
}
.cc-feedback-sheet__close:focus-visible {
  outline: 3px solid rgba(14, 124, 107, 0.35);
  outline-offset: 2px;
}
.cc-feedback-sheet__icon {
  display: grid;
  width: 68px;
  height: 68px;
  margin: 10px 0 var(--cc-space-5);
  place-items: center;
  border-radius: var(--cc-radius-pill);
}
.cc-feedback-sheet__body--success .cc-feedback-sheet__icon {
  background: rgba(46, 158, 91, 0.14);
  color: var(--cc-color-success);
}
.cc-feedback-sheet__body--danger .cc-feedback-sheet__icon {
  background: var(--cc-error-surface);
  color: var(--cc-error-surface-text);
}
.cc-feedback-sheet__body--warning .cc-feedback-sheet__icon {
  background: var(--cc-color-warning-tint);
  color: var(--cc-color-warning-text);
}
.cc-feedback-sheet__body--info .cc-feedback-sheet__icon {
  background: rgba(43, 125, 189, 0.14);
  color: var(--cc-color-info);
}
.cc-feedback-sheet__title {
  max-width: 330px;
  margin: 0 0 var(--cc-space-2);
  color: var(--cc-ink-900);
  font-family: var(--cc-font-interface);
  font-size: 21px;
  line-height: 28px;
  font-weight: 700;
}
.cc-feedback-sheet__message {
  max-width: 360px;
  margin: 0;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: var(--cc-text-body-size);
  line-height: var(--cc-text-body-line);
}
.cc-feedback-sheet__reference {
  margin: var(--cc-space-3) 0 0;
  color: var(--cc-ink-300);
  font-family: var(--cc-font-interface);
  font-size: 12px;
  line-height: 18px;
}
.cc-feedback-sheet__code {
  display: inline-block;
  margin-left: 4px;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-mono);
  font-size: 12.5px;
  font-weight: 500;
  letter-spacing: 0.04em;
  user-select: text;
  -webkit-user-select: text;
}
.cc-feedback-sheet__action {
  margin-top: var(--cc-space-7);
}
</style>