<template>
  <ion-page>
    <div class="cc-catalog__header">
      <div class="cc-catalog__title-row">
        <button
          v-if="guestMode"
          type="button"
          class="cc-catalog__back"
          aria-label="Back"
          @click="router.back()"
        >
          <AppIcon name="arrow_back_ios_new" :size="22" color="var(--cc-ink-900)" />
        </button>
        <h1 class="cc-text-h1" style="margin: 0">Shop</h1>
        <button type="button" class="cc-catalog__cart" aria-label="Cart" @click="goCart">
          <AppIcon name="shopping_cart" :size="26" color="var(--cc-ink-600)" />
          <span v-if="cart.itemCount > 0" class="cc-catalog__cart-badge">{{ cart.itemCount }}</span>
        </button>
      </div>
      <div class="cc-catalog__search">
        <AppIcon name="search" :size="20" color="var(--cc-ink-400)" />
        <input v-model="search" type="search" placeholder="Search products & services" />
      </div>
      <div class="cc-catalog__chips">
        <AppChip label="All" :selected="category === ''" @click="category = ''" />
        <AppChip
          v-for="c in categories"
          :key="c"
          :label="c"
          :selected="category === c"
          @click="category = c"
        />
      </div>
    </div>

    <ion-content class="cc-screen">
      <LoadingState v-if="isPending" label="Loading products…" />
      <EmptyState
        v-else-if="!products.length"
        icon="storefront"
        title="No products found"
        message="Try a different search or category."
      />
      <div v-else class="cc-catalog__grid">
        <button
          v-for="p in products"
          :key="p.id"
          type="button"
          class="cc-product-card"
          @click="router.push({ name: 'product-detail', params: { id: p.id } })"
        >
          <div class="cc-product-card__media">
            <img :src="p.media[0]?.url" :alt="p.media[0]?.alt ?? p.name" />
            <span v-if="p.stock === 0" class="cc-product-card__oos">Out of stock</span>
          </div>
          <div class="cc-product-card__body">
            <div class="cc-text-body-strong" style="font-size: 16px">{{ p.name }}</div>
            <div class="cc-text-caption" style="margin-bottom: 8px">{{ p.category }}</div>
            <div class="cc-product-card__foot">
              <MoneyAmount :value="p.price" :currency="p.currency" />
              <button
                v-if="p.stock > 0"
                type="button"
                class="cc-product-card__add"
                :aria-label="`Add ${p.name} to cart`"
                @click.stop="onAdd(p.id)"
              >
                <AppIcon name="add" :size="20" color="var(--cc-color-primary)" />
              </button>
              <span v-else class="cc-text-body-strong" style="font-size: 11.5px; color: var(--cc-color-primary)"
                >Notify me</span
              >
            </div>
          </div>
        </button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppChip, AppIcon, MoneyAmount } from '@/components/ui';
import { EmptyState, LoadingState } from '@/components/state';
import { useProducts } from '@/composables/useProducts';
import { useCartStore } from '@/stores/cart';
import { useToast } from '@/composables/useToast';

/** C1 · Catalog. `guestMode` (set via the standalone /shop/guest route) lets
 * an unauthenticated visitor browse per the PRD Guest capability, routing
 * add-to-cart and product taps to login instead. */
const props = defineProps<{ guestMode?: boolean }>();

const router = useRouter();
const cart = useCartStore();
const toast = useToast();

const search = ref('');
const category = ref('');
const categories = ['Spices', 'Capsules', 'Teas', 'Topicals', 'Devices', 'Extracts'];

const query = computed(() => ({ search: search.value || undefined, category: category.value || undefined }));
const { data, isPending } = useProducts(query);
const products = computed(() => data.value?.data ?? []);

async function onAdd(productId: string) {
  if (props.guestMode) {
    router.push({ name: 'login' });
    return;
  }
  await cart.addItem(productId, 1);
  await toast.show('Added to cart', 'success');
}

function goCart() {
  router.push({ name: props.guestMode ? 'login' : 'cart' });
}
</script>

<style scoped>
.cc-catalog__header {
  padding: calc(env(safe-area-inset-top) + 4px) 16px 12px;
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.62) 55%, rgba(247, 250, 249, 0.92));
}
.cc-catalog__title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}
.cc-catalog__title-row .cc-text-h1 {
  flex: 1;
}
.cc-catalog__back {
  background: none;
  border: none;
  display: flex;
  align-items: center;
  padding: 0;
  margin-left: -6px;
  cursor: pointer;
}
.cc-catalog__cart {
  position: relative;
  background: none;
  border: none;
  display: flex;
  cursor: pointer;
}
.cc-catalog__cart-badge {
  position: absolute;
  top: -4px;
  left: calc(100% - 8px);
  min-width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--cc-color-primary);
  border: 2px solid var(--cc-surface-0);
  color: #fff;
  font: 600 11.5px/14.5px var(--cc-font-interface);
  text-align: center;
}
.cc-catalog__search {
  height: 44px;
  border-radius: var(--cc-radius-md);
  background: var(--cc-surface-app);
  border: 1px solid var(--cc-line);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  margin-bottom: 12px;
}
.cc-catalog__search input {
  border: none;
  background: none;
  outline: none;
  flex: 1;
  font-family: var(--cc-font-interface);
  font-size: 13.5px;
}
.cc-catalog__chips {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  overflow-x: auto;
}
.cc-catalog__chips :deep(.cc-chip) {
  flex-shrink: 0;
  padding-top: 6px;
  padding-bottom: 6px;
}
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-catalog__grid {
  padding: 14px 16px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.cc-product-card {
  background: var(--cc-surface-0);
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-lg);
  overflow: hidden;
  padding: 0;
  text-align: left;
  cursor: pointer;
}
.cc-product-card__media {
  height: 118px;
  padding: 8px;
  box-sizing: border-box;
  position: relative;
}
.cc-product-card__media img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.cc-product-card__oos {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #edf1ef;
  color: #4a5a53;
  font: 600 11.5px/16px var(--cc-font-interface);
}
.cc-product-card__body {
  padding: 12px;
}
.cc-product-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cc-product-card__add {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--cc-color-mist);
  border: none;
  display: grid;
  place-items: center;
  cursor: pointer;
}
</style>
