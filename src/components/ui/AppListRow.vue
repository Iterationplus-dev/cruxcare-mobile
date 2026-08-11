<template>
  <component
    :is="clickable ? 'button' : 'div'"
    class="cc-row"
    :class="{ 'cc-row--clickable': clickable, 'cc-row--divider': divider }"
    :type="clickable ? 'button' : undefined"
    @click="clickable ? emit('click') : undefined"
  >
    <AppIcon v-if="icon" :name="icon" :size="20" :color="iconColor" class="cc-row__icon" />
    <span v-else-if="$slots.leading" class="cc-row__icon"><slot name="leading" /></span>
    <span class="cc-row__body">
      <span class="cc-row__title">{{ title }}</span>
      <span v-if="subtitle" class="cc-row__subtitle">{{ subtitle }}</span>
    </span>
    <span v-if="$slots.trailing" class="cc-row__trailing"><slot name="trailing" /></span>
    <AppIcon
      v-else-if="chevron"
      name="chevron_right"
      :size="20"
      color="var(--cc-ink-400)"
      class="cc-row__chevron"
    />
  </component>
</template>

<script setup lang="ts">
import AppIcon from './AppIcon.vue';

withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    icon?: string;
    iconColor?: string;
    chevron?: boolean;
    clickable?: boolean;
    divider?: boolean;
  }>(),
  {
    iconColor: 'var(--cc-color-primary)',
    chevron: false,
    clickable: false,
    divider: true,
  },
);

const emit = defineEmits<{ click: [] }>();
</script>

<style scoped>
.cc-row {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 13px 14px;
  width: 100%;
  background: transparent;
  border: none;
  text-align: left;
  font-family: var(--cc-font-interface);
  min-height: var(--cc-touch-min);
  box-sizing: border-box;
}
.cc-row--clickable {
  cursor: pointer;
}
.cc-row--divider {
  border-bottom: 1px solid var(--cc-divider);
}
.cc-row__icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.cc-row__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.cc-row__title {
  font-size: 14.5px;
  line-height: 23px;
  color: var(--cc-ink-900);
}
.cc-row__subtitle {
  font-size: 12.5px;
  line-height: 19px;
  color: var(--cc-ink-400);
}
.cc-row__trailing,
.cc-row__chevron {
  flex-shrink: 0;
}
</style>
