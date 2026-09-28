<template>
  <ion-page>
    <ion-content class="cc-screen">
      <AppPullToRefresh :query-keys="[['products']]" />
      <LoadingState v-if="isPending" label="Loading product…" />
      <template v-else-if="product">
        <div class="cc-pd__gallery">
          <ion-buttons class="cc-pd__back">
            <button type="button" class="cc-pd__back-btn" aria-label="Back" @click="goBack">
              <AppIcon name="arrow_back_ios_new" :size="22" color="var(--cc-ink-900)" />
            </button>
          </ion-buttons>
          <ProductImage :media="product.media" :name="formatProductTitle(product.name)" class="cc-pd__image" />
        </div>
        <div class="cc-pd__body">
          <div class="cc-pd__badges">
            <AppBadge v-if="product.stock > 0" label="In stock" tone="success" />
            <AppBadge v-else label="Out of stock" tone="danger" />
          </div>
          <h2 class="cc-text-h1" style="margin: 0 0 4px">{{ formatProductTitle(product.name) }}</h2>
          <div class="cc-text-subtitle" style="margin-bottom: 14px">{{ product.category }}</div>
          <MoneyAmount :value="product.price" :currency="product.currency" size="display" />
          <p v-if="product.description" class="cc-text-body" style="margin: 16px 0">{{ product.description }}</p>
          <p v-else class="cc-pd__description-empty cc-text-body" role="status">
            A description is not available for this product yet.
          </p>

          <!-- C2's collapsible detail. Delivery is the same for every product,
               so it is written here; the other two describe the product and
               have to come from the product. -->
          <div class="cc-pd__sections">
            <ProductDetailSection title="How to use" :body="product.howToUse" />
            <ProductDetailSection title="Ingredients" :body="product.ingredients" />
            <ProductDetailSection
              title="Delivery &amp; pickup"
              body="Delivered to the address on your profile, or collected from a CruxCare outlet. You choose at checkout, and the cost is shown before you pay."
            />
          </div>
        </div>

        <!-- Recommending puts this product on a client's case rather than in
             a basket. Quantity is carried on the line, so it is set here. -->
        <div v-if="recommendFor" class="cc-pd__recommend">
          <div class="cc-pd__recommend-qty">
            <span class="cc-pd__recommend-label">How many</span>
            <div class="cc-pd__stepper">
              <button type="button" aria-label="Fewer" @click="quantity = Math.max(1, quantity - 1)">
                <AppIcon name="remove" :size="22" color="var(--cc-color-primary)" />
              </button>
              <span class="cc-text-mono">{{ quantity }}</span>
              <button type="button" aria-label="More" @click="quantity += 1">
                <AppIcon name="add" :size="22" color="var(--cc-color-primary)" />
              </button>
            </div>
          </div>
          <label class="cc-pd__recommend-label" :for="noteId">Suggested use (optional)</label>
          <textarea
            :id="noteId"
            v-model="useNote"
            class="cc-textarea"
            rows="2"
            maxlength="240"
            placeholder="e.g. One capsule after the evening meal, for the first six weeks."
          />
          <p class="cc-pd__recommend-hint">
            {{ recommendClient || 'Your client' }} accepts this on their care screen before it is
            added to what they owe. Nothing is charged by adding it here.
          </p>
          <AppButton :disabled="product.stock === 0" :loading="adding" @click="onRecommend">
            Add to treatment plan ·
            <MoneyAmount :value="product.price * quantity" :currency="product.currency" />
          </AppButton>
        </div>

        <!-- Opened from a case's recommendation list, so there is no basket in
             this story at all. The client pays for it with their treatment, on
             the case bill, at the price captured when it was recommended —
             buying a second copy here would charge them twice for one
             prescription at a price that may since have moved. The therapist
             arrives the same way and is not shopping either. -->
        <div v-else-if="fromRecommendation" class="cc-screen__footer cc-pd__prescribed">
          <AppIcon name="medical_information" :size="20" color="var(--cc-color-primary)" />
          <p>{{ prescribedNote }}</p>
        </div>

        <div v-else class="cc-screen__footer">
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
import { AppPullToRefresh } from '@/components/ui';
import { computed, ref, useId } from 'vue';
import { IonButtons, IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppBadge, AppButton, AppIcon, MoneyAmount } from '@/components/ui';
import ProductImage from '@/components/marketplace/ProductImage.vue';
import ProductDetailSection from '@/components/marketplace/ProductDetailSection.vue';
import { LoadingState } from '@/components/state';
import { useProduct } from '@/composables/useProducts';
import { caseFilesApi } from '@/api/case-files.api';
import { ApiError } from '@/types/api';
import { useCartStore } from '@/stores/cart';
import { useToast } from '@/composables/useToast';
import { useAuthStore } from '@/stores/auth';
import { useQueryClient } from '@tanstack/vue-query';
import { formatProductTitle } from '@/features/marketplace/productPresentation';

const route = useRoute();
const router = useRouter();
const cart = useCartStore();
const toast = useToast();
const auth = useAuthStore();
const queryClient = useQueryClient();

/** Set when a therapist reached this screen from a case file (see
 *  CatalogScreen). It replaces buying with recommending. */
const recommendFor = computed(() => (route.query.recommendFor as string) || '');
const recommendClient = computed(() => (route.query.client as string) || '');

/**
 * Set when this screen was opened from a case's recommendation list — by the
 * client reading what was prescribed, or by the therapist checking what they
 * prescribed. Either way the cart is the wrong rail, so it is not offered.
 */
const fromRecommendation = computed(() => route.query.from === 'case-recommendation');
const prescribedNote = computed(() =>
  auth.activeRole === 'therapist'
    ? 'This is on your client’s treatment plan. They accept and pay for it there, not from a basket.'
    : 'This is on your treatment plan. You pay for it with your treatment on the care plan screen — there is nothing to add to a basket.',
);
const useNote = ref('');
const noteId = `cc-use-note-${useId()}`;

/** Guests arrive here from /shop/guest, so fall back there rather than the tab. */
function goBack() {
  if (window.history.state?.back) router.back();
  else router.replace(auth.isAuthenticated ? '/tabs/shop' : '/shop/guest');
}

const { data: product, isPending } = useProduct(route.params.id as string);
const quantity = ref(1);
const adding = ref(false);

/**
 * Records the product against the client's case. This is the whole point of
 * the mode: the therapist is prescribing, not shopping, and the cost belongs
 * on the client's bill rather than on a basket the therapist would check out.
 */
async function onRecommend() {
  if (!product.value || adding.value) return;
  adding.value = true;
  try {
    await caseFilesApi.addRecommendation(
      recommendFor.value,
      product.value.id,
      useNote.value.trim() || null,
      quantity.value,
    );
    await queryClient.invalidateQueries({ queryKey: ['case-files'] });
    await toast.show(
      `${recommendClient.value || 'Your client'} will see it on their case.`,
      'success',
      { title: 'Added to the treatment plan' },
    );
    router.back();
  } catch (error) {
    const message =
      error instanceof ApiError ? error.message : 'We could not add that. Please try again.';
    await toast.show(message, 'danger', { title: 'Not added' });
  } finally {
    adding.value = false;
  }
}

async function onAdd() {
  if (!product.value) return;
  // Guests can browse this screen but need an account to hold a cart.
  if (!auth.isAuthenticated) {
    router.push({ name: 'login' });
    return;
  }
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
.cc-pd__recommend {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
  background: var(--cc-surface-0);
}
.cc-pd__recommend-qty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.cc-pd__recommend-label {
  color: var(--cc-ink-900);
  font-family: var(--cc-font-interface);
  font-size: 13.5px;
  font-weight: 600;
  line-height: 20px;
}
.cc-pd__recommend .cc-textarea {
  width: 100%;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-sm);
  padding: 9px 12px;
  font-family: var(--cc-font-interface);
  font-size: 13.5px;
  box-sizing: border-box;
  resize: vertical;
}
.cc-pd__recommend-hint {
  margin: 0 0 2px;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 12px;
  line-height: 17px;
}
.cc-pd__sections {
  margin-top: 18px;
  border-bottom: 1px solid var(--cc-line);
}
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
  top: calc(env(safe-area-inset-top) + 6px);
  left: 4px;
}
.cc-pd__back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--cc-touch-min);
  height: var(--cc-touch-min);
  background: none;
  border: none;
  cursor: pointer;
}
.cc-pd__image {
  width: 248px;
  height: 248px;
  object-fit: contain;
}
.cc-pd__body {
  padding: 18px 16px 0;
}
.cc-pd__prescribed {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.cc-pd__prescribed p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 13px;
  line-height: 1.5;
  color: var(--cc-ink-600);
}
.cc-pd__description-empty {
  margin: 16px 0;
  color: var(--cc-ink-500);
  font-style: italic;
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
