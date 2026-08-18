<template>
  <div class="cc-product-image">
    <template v-if="primaryMedia && !imageLoadFailed">
      <div v-if="imageLoading" class="cc-product-image__loader" aria-hidden="true" />
      <!-- Cloudinary already provides the delivery transformations: retain its URL exactly. -->
      <img
        :class="{ 'cc-product-image__img--ready': !imageLoading }"
        :src="primaryMedia.url"
        :alt="primaryMedia.alt || name"
        loading="lazy"
        decoding="async"
        @load="imageLoading = false"
        @error="onImageError"
      />
    </template>
    <div v-else class="cc-product-image__fallback" role="img" :aria-label="`${name} image unavailable`">
      <AppIcon name="inventory_2" :size="32" color="var(--cc-ink-300)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import type { ProductMedia } from '@/types/marketplace';

const props = defineProps<{
  media: ProductMedia[];
  name: string;
}>();

const imageLoadFailed = ref(false);
const primaryMedia = computed(() => props.media.find((item) => item.url.trim()) ?? null);
const imageLoading = ref(Boolean(primaryMedia.value));

function onImageError() {
  imageLoading.value = false;
  imageLoadFailed.value = true;
}

watch(
  () => primaryMedia.value?.url,
  (url) => {
    imageLoadFailed.value = false;
    imageLoading.value = Boolean(url);
  },
);
</script>

<style scoped>
.cc-product-image {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
  background: var(--cc-surface-app);
}
.cc-product-image > img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: inherit;
  opacity: 0;
  transition: opacity 160ms ease-out;
}
.cc-product-image > .cc-product-image__img--ready {
  opacity: 1;
}
.cc-product-image__loader {
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, var(--cc-surface-app) 25%, var(--cc-color-mist) 45%, var(--cc-surface-app) 65%);
  background-size: 220% 100%;
  animation: cc-product-image-shimmer 1.2s ease-in-out infinite;
}
.cc-product-image__fallback {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: grid;
  place-items: center;
  border-radius: inherit;
  background: var(--cc-surface-app);
}
@keyframes cc-product-image-shimmer {
  to {
    background-position: -220% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cc-product-image__loader {
    animation: none;
  }
  .cc-product-image > img {
    transition: none;
  }
}
</style>
