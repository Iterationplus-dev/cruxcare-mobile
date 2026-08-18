<template>
  <ion-page>
    <AppHeader title="Your cart" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[]" :refresh="cart.load" />
      <LoadingState v-if="cart.loading && !cart.cart" label="Loading your cart…" />
      <EmptyState
        v-else-if="!cart.cart?.items.length"
        icon="shopping_cart"
        title="Your cart is empty"
        message="Browse the shop to add products."
        primary-action="Browse the shop"
        @primary="router.push({ name: 'catalog' })"
      />
      <template v-else>
        <div class="cc-screen__pad">
          <AppCard style="padding: 0">
            <div v-for="item in cart.cart.items" :key="item.id" class="cc-cart-row">
              <ProductImage :media="item.product.media" :name="formatProductTitle(item.product.name)" class="cc-cart-row__image" />
              <div class="cc-cart-row__body">
                <div class="cc-text-body-strong" style="font-size: 14.5px">{{ formatProductTitle(item.product.name) }}</div>
                <div class="cc-text-caption">{{ item.quantity }} × <MoneyAmount :value="item.product.price" :currency="item.product.currency" size="mono" /></div>
              </div>
              <div class="cc-cart-row__end">
                <MoneyAmount :value="item.product.price * item.quantity" :currency="item.product.currency" />
                <button type="button" class="cc-cart-row__remove" aria-label="Remove item" @click="cart.removeItem(item.id)">
                  <AppIcon name="close" :size="16" color="var(--cc-ink-400)" />
                </button>
              </div>
            </div>
          </AppCard>

          <AppCard>
            <div class="cc-cart-total-row">
              <span class="cc-text-body">Subtotal</span>
              <MoneyAmount :value="cart.cart.subtotal" :currency="cart.cart.currency" />
            </div>
            <p class="cc-text-caption" style="margin: 6px 0 0">
              Totals and stock are re-checked by CruxCare at checkout.
            </p>
          </AppCard>

          <div class="cc-cart-onbehalf">
            <AppIcon name="medical_services" :size="20" color="var(--cc-color-primary)" />
            <p>Ordering for a client? Switch to your therapist context to attribute this order.</p>
          </div>
        </div>

        <div class="cc-screen__footer">
          <AppButton @click="router.push({ name: 'checkout' })">
            Checkout · <MoneyAmount :value="cart.cart.subtotal" :currency="cart.cart.currency" />
          </AppButton>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { AppPullToRefresh } from '@/components/ui';
import { onMounted } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppButton, AppCard, AppHeader, AppIcon, MoneyAmount } from '@/components/ui';
import ProductImage from '@/components/marketplace/ProductImage.vue';
import { EmptyState, LoadingState } from '@/components/state';
import { useCartStore } from '@/stores/cart';
import { formatProductTitle } from '@/features/marketplace/productPresentation';

const router = useRouter();
const cart = useCartStore();
onMounted(() => cart.load());
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cc-cart-row {
  display: flex;
  gap: 12px;
  padding: 12px;
  border-bottom: 1px solid var(--cc-divider);
  align-items: center;
}
.cc-cart-row:last-child {
  border-bottom: none;
}
.cc-cart-row__image {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: var(--cc-surface-app);
  object-fit: contain;
  padding: 5px;
  box-sizing: border-box;
}
.cc-cart-row__body {
  flex: 1;
}
.cc-cart-row__end {
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.cc-cart-row__remove {
  background: none;
  border: none;
  cursor: pointer;
}
.cc-cart-total-row {
  display: flex;
  justify-content: space-between;
}
.cc-cart-onbehalf {
  background: var(--cc-color-mist);
  border-radius: var(--cc-radius-lg);
  padding: 14px;
  display: flex;
  gap: 10px;
}
.cc-cart-onbehalf p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 17px;
  color: var(--cc-ink-600);
}
.cc-screen__footer {
  padding: 11px 14px calc(25px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
</style>
