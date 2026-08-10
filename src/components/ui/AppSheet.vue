<template>
  <ion-modal
    :is-open="modelValue"
    :handle="false"
    class="cc-sheet"
    @did-dismiss="emit('update:modelValue', false)"
  >
    <div class="cc-sheet__content">
      <div class="cc-sheet__grabber" aria-hidden="true" />
      <h2 v-if="title" class="cc-sheet__title cc-text-h1">{{ title }}</h2>
      <slot />
    </div>
  </ion-modal>
</template>

<script setup lang="ts">
import { IonModal } from '@ionic/vue';

defineProps<{ modelValue: boolean; title?: string }>();
const emit = defineEmits<{ 'update:modelValue': [boolean] }>();
</script>

<style>
/* Not scoped: ion-modal renders its content in a shadow-root-adjacent
   overlay outside this component's normal DOM tree. */
/* Height follows the content instead of Ionic's breakpoint sheet (which
   always filled the viewport), capped so a long sheet still stops short of
   the status bar and scrolls internally. */
.cc-sheet::part(content) {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: auto;
  max-height: 85vh;
  border-radius: var(--cc-radius-sheet) var(--cc-radius-sheet) 0 0;
  background: var(--cc-surface-0);
}
.cc-sheet::part(backdrop) {
  background: rgba(26, 43, 34, 0.45);
}
</style>

<style scoped>
.cc-sheet__content {
  padding: 8px 16px calc(16px + env(safe-area-inset-bottom));
  max-height: 85vh;
  overflow-y: auto;
}
.cc-sheet__grabber {
  width: 36px;
  height: 4px;
  border-radius: var(--cc-radius-pill);
  background: var(--cc-line);
  margin: 0 auto 16px;
}
.cc-sheet__title {
  margin: 0 0 12px;
}
</style>
