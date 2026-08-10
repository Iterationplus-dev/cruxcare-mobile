<template>
  <ion-page>
    <ion-content class="cc-screen">
      <LoadingState v-if="isPending" label="Loading product…" />
      <template v-else-if="product">
        <div class="cc-pd__gallery">
          <ion-buttons class="cc-pd__back">
            <ion-back-button default-href="/tabs/shop" text="" />
          </ion-buttons>
          <img :src="product.media[0]?.url" :alt="product.media[0]?.alt ?? product.name" />
        </div>
        <div class="cc-pd__body">
          <div class="cc-pd__badges">
            <AppBadge v-if="product.stock > 0" label="In stock" tone="success" />
            <AppBadge v-else label="Out of stock" tone="danger" />
          </div>
          <h2 class="cc-text-h1" style="margin: 0 0 4px">{{ product.name }}</h2>
          <div class="cc-text-subtitle" style="margin-bottom: 14px">{{ product.category }}</div>
          <MoneyAmount :value="product.price" :currency="product.currency" size="display" />
          <p class="cc-text-body" style="margin: 16px 0">{{ product.description }}</p>
        </div>

        <div class="cc-screen__footer">
          <div class="cc-pd__stepper">
            <button type="button" aria-label="Decrease quantity" @click="quantity = Math.max(1, quantity - 1)">
              <AppIcon name="remove" :size="22" color="var(--cc-color-primary)" />
            </button>
            <span class="cc-text-mono">{{ quantity }}</span>
            <button type="button" aria-label="Increase quantity" @click="quantity += 1">
              <AppIcon name="add" :size="22" color="var(--cc-color-primary)" />
            </button>
          </div>
          <AppButton :disabled="product.stock === 0" :loading="adding" @click="onAdd">
            Add to cart · <MoneyAmount :value="product.price * quantity" :currency="product.currency" />
          </AppButton>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonBackButton, IonButtons, IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppBadge, AppButton, AppIcon, MoneyAmount } from '@/components/ui';
import { LoadingState } from '@/components/state';
import { useProduct } from '@/composables/useProducts';
import { useCartStore } from '@/stores/cart';
import { useToast } from '@/composables/useToast';

const route = useRoute();
const router = useRouter();
const cart = useCartStore();
const toast = useToast();

const { data: product, isPending } = useProduct(route.params.id as string);
const quantity = ref(1);
const adding = ref(false);

async function onAdd() {
  if (!product.value) return;
  adding.value = true;
  try {
    await cart.addItem(product.value.id, quantity.value);
    await toast.show('Added to cart', 'success');
    router.push({ name: 'cart' });
  } finally {
    adding.value = false;
  }
}
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-0);
}
.cc-pd__gallery {
  height: 300px;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.62) 55%, rgba(247, 250, 249, 0.92));
  display: grid;
  place-items: center;
  position: relative;
}
.cc-pd__back {
  position: absolute;
  top: 6px;
  left: 4px;
}
.cc-pd__gallery img {
  width: 248px;
  height: 248px;
  object-fit: contain;
}
.cc-pd__body {
  padding: 18px 16px 0;
}
.cc-pd__badges {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.cc-screen__footer {
  padding: 11px 14px calc(25px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
  display: flex;
  gap: 10px;
  align-items: center;
}
.cc-screen__footer :deep(.cc-btn) {
  flex: 1;
}
.cc-pd__stepper {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 47px;
  padding: 0 10px;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-md);
}
.cc-pd__stepper button {
  background: none;
  border: none;
  display: flex;
  cursor: pointer;
}
.cc-pd__stepper span {
  min-width: 20px;
  text-align: center;
  font-size: 17px;
}
</style>
