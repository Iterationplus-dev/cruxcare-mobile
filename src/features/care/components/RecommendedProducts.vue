<template>
  <section v-if="groups.length" class="cc-rp" aria-labelledby="recommended-title">
    <div class="cc-rp__head">
      <h2 id="recommended-title" class="cc-text-body-strong">Recommended for your treatment</h2>
      <p class="cc-text-caption">
        Your therapist suggested these. Nothing is charged until you accept it.
      </p>
    </div>

    <!-- Only from two up: with one pending line, "add all" and the button on
         the card itself are the same button asked twice. The total is shown
         because accepting is what turns these into money owed, and agreeing to
         four things at once should say what four things cost. -->
    <div v-if="pending.length > 1" class="cc-rp__bulk">
      <div class="cc-rp__bulk-text">
        <span class="cc-text-body-strong">{{ pending.length }} waiting for your answer</span>
        <span class="cc-text-caption">
          Adds all of them ·
          <MoneyAmount :value="pendingTotalMinor / 100" :currency="pendingCurrency" />
        </span>
      </div>
      <AppButton :loading="busy === BULK_KEY" :full-width="false" @click="acceptAll">
        Add all to my plan
      </AppButton>
    </div>

    <AppCard v-for="line in groups" :key="line.key" class="cc-rp__line">
      <!-- The image spans the whole card, so the name, the note and the status
           underneath all share one left edge. Inside the top row it indented
           the name and left everything below it hanging at the card's edge. -->
      <ProductImage
        :media="findProduct(line.productId)?.media ?? []"
        :name="formatProductTitle(line.productName)"
        class="cc-rp__thumb"
      />

      <div class="cc-rp__body">
        <div class="cc-rp__top">
          <div class="cc-rp__name">
            <!-- Title-cased like the shop and the care hub: the API stores
                 names in caps, and shouting them at the client is not a
                 design. -->
            <span class="cc-text-body-strong">{{ formatProductTitle(line.productName) }}</span>
            <span class="cc-text-caption">
              {{ line.quantity }} ×
              <MoneyAmount :value="line.unitPrice" :currency="line.currency" />
            </span>
          </div>
          <MoneyAmount :value="line.total" :currency="line.currency" />
        </div>

        <!-- The dosing instructions the therapist wrote. They are the reason
             the product is on the list, so they sit above the decision, not
             below. A grouped row can carry more than one if the therapist
             wrote differently each time; identical ones are folded. -->
        <p v-for="note in line.notes" :key="note" class="cc-rp__note">{{ note }}</p>

        <!-- There is no decline. A line the client does not want is left alone
             and taken off by the therapist, so the only action here is to
             accept. Saying that plainly beats an unexplained single button. -->
        <template v-if="line.status === 'pending'">
          <AppButton :loading="busy === line.key" @click="accept(line)">Add to my plan</AppButton>
          <p class="cc-rp__leave">
            Not for you? Leave it — it costs nothing. Message your therapist and they will take
            it off.
          </p>
        </template>

        <p v-else class="cc-rp__settled">
          <AppIcon name="check_circle" :size="16" color="var(--cc-color-primary)" />
          <span>{{ settledLabel(line) }}</span>
        </p>

        <!-- Reading what was prescribed, not shopping for it: the flag tells
             the product screen to leave the basket out. -->
        <button type="button" class="cc-rp__view" @click="viewProduct(line)">
          What is in this?
        </button>
      </div>
    </AppCard>

    <!-- Shown here and on the bill: the two screens where the client agrees to
         a product and where they pay for it. The wording comes from the server
         so both say the same thing and it can be corrected without a release. -->
    <p v-if="disclaimer" class="cc-rp__disclaimer">{{ disclaimer }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useQueryClient } from '@tanstack/vue-query';
import { AppButton, AppCard, AppIcon, MoneyAmount } from '@/components/ui';
import { useCaseRecommendations } from '@/composables/useCaseFiles';
import { casesApi } from '@/api/cases.api';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';
import { formatMinor } from '@/utils/money';
import { formatProductTitle } from '@/features/marketplace/productPresentation';
import { useProductLookup } from '@/composables/useProducts';
import ProductImage from '@/components/marketplace/ProductImage.vue';
import { groupRecommendations, type RecommendationGroup } from '@/features/care/recommendationGroups';

/**
 * The products a therapist put on this case, and the client's answer to each.
 *
 * Accepting is what turns a suggestion into money owed — the therapist can put
 * a product on the case, but only the person paying decides it is theirs.
 * There is no decline: an unwanted line is left pending, which costs nothing,
 * and the therapist withdraws it.
 */
const props = defineProps<{ caseId: string }>();

const toast = useToast();
const router = useRouter();
const queryClient = useQueryClient();
const { data } = useCaseRecommendations(() => props.caseId);

function viewProduct(line: RecommendationGroup) {
  router.push({
    name: 'product-detail',
    params: { id: line.productId },
    query: { from: 'case-recommendation' },
  });
}
/** One row per product, per state, per captured price — see
 *  `groupRecommendations` for why those three and not just the product. */
const groups = computed(() => groupRecommendations(data.value?.lines));
const disclaimer = computed(() => data.value?.productDisclaimer ?? null);
const busy = ref<string | null>(null);
const { findProduct } = useProductLookup();

/** Not a product key, so it can never collide with a row's own busy state. */
const BULK_KEY = '__all__';

const pending = computed(() => groups.value.filter((g) => g.status === 'pending'));
const pendingTotalMinor = computed(() =>
  pending.value.reduce((sum, g) => sum + g.totalMinor, 0),
);
/** Every line on a case is priced in one currency, so the first row's is the
 *  case's. Falls back rather than rendering an empty symbol. */
const pendingCurrency = computed(() => pending.value[0]?.currency ?? 'USD');

function settledLabel(line: RecommendationGroup) {
  const paid = line.paidMinor;
  if (paid >= line.totalMinor) return 'Paid';
  if (paid > 0) {
    return `Part paid — ${formatMinor(paid, line.currency)} of ${formatMinor(line.totalMinor, line.currency)}`;
  }
  return 'On your plan, not paid yet';
}

/**
 * Accepts every pending line on the case, in one go.
 *
 * Sequential rather than parallel: each call returns a recomputed bill, and
 * firing them together makes the server total the same case several times at
 * once for no gain on a list this short.
 *
 * It stops at the first refusal rather than pressing on. The lines already
 * accepted stand — they are, and the refetch below shows exactly which — but
 * continuing past a "no" risks repeating whatever caused it against every
 * remaining line, and the count in the message has to be true.
 */
async function acceptAll() {
  if (busy.value) return;
  const rows = pending.value;
  if (!rows.length) return;

  busy.value = BULK_KEY;
  let accepted = 0;
  let failure: unknown = null;

  try {
    for (const group of rows) {
      for (const lineId of group.lineIds) {
        await casesApi.acceptRecommendation(props.caseId, lineId);
      }
      accepted += 1;
    }
  } catch (error) {
    failure = error;
  } finally {
    await queryClient.invalidateQueries({ queryKey: ['case-recommendations'] });
    await queryClient.invalidateQueries({ queryKey: ['case-bill'] });
    busy.value = null;
  }

  if (failure) {
    const message =
      failure instanceof ApiError ? failure.message : 'We could not add all of them.';
    // Says what did land. "Nothing was saved" would be untrue the moment one
    // of them went through, and the client is about to see it on their bill.
    await toast.show(
      accepted > 0 ? `${accepted} were added. ${message}` : message,
      'danger',
      { title: accepted > 0 ? 'Partly added' : 'Not saved' },
    );
    return;
  }

  await toast.show(
    `${accepted} products are on your plan. You pay for them with your treatment.`,
    'success',
    { title: 'Added' },
  );
}

/**
 * Accepts every pending line behind the row.
 *
 * The row is one product to the client, but the server still holds each
 * recommendation separately — so a row standing for two lines is two calls,
 * and the row is only settled when both are.
 */
async function accept(group: RecommendationGroup) {
  if (busy.value) return;
  busy.value = group.key;
  try {
    for (const lineId of group.lineIds) {
      await casesApi.acceptRecommendation(props.caseId, lineId);
    }
    // The calls return the recomputed bill, but the list and the bill card are
    // separate readers — invalidating both keeps them from disagreeing.
    await queryClient.invalidateQueries({ queryKey: ['case-recommendations'] });
    await queryClient.invalidateQueries({ queryKey: ['case-bill'] });
    await toast.show(
      `${formatProductTitle(group.productName)} is on your plan. You pay for it with your treatment.`,
      'success',
      { title: 'Added' },
    );
  } catch (error) {
    // A part-accepted row is why this refetches rather than reverting: some of
    // the lines may well have gone through before one failed.
    await queryClient.invalidateQueries({ queryKey: ['case-recommendations'] });
    await queryClient.invalidateQueries({ queryKey: ['case-bill'] });
    const message =
      error instanceof ApiError ? error.message : 'We could not save that. Please try again.';
    await toast.show(message, 'danger', { title: 'Not saved' });
  } finally {
    busy.value = null;
  }
}
</script>

<style scoped>
.cc-rp {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 18px;
}
.cc-rp__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cc-rp__head h2 {
  margin: 0;
  font-size: 16px;
}
.cc-rp__bulk {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--cc-color-primary) 28%, transparent);
  border-radius: var(--cc-radius-lg);
  background: var(--cc-color-mist);
}
.cc-rp__bulk-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.cc-rp__line {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.cc-rp__body {
  display: flex;
  flex-direction: column;
  gap: 9px;
  /* Lets the rows inside wrap rather than pushing past the card. */
  min-width: 0;
  flex: 1;
}
.cc-rp__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.cc-rp__thumb {
  flex: none;
  width: 52px;
  height: 52px;
  border-radius: var(--cc-radius-sm);
  overflow: hidden;
  background: var(--cc-color-mist);
}
.cc-rp__name {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.cc-rp__leave {
  margin: 0;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 12px;
  line-height: 17px;
}
.cc-rp__disclaimer {
  margin: 2px 0 0;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 17px;
}
.cc-rp__note {
  margin: 0;
  padding: 9px 11px;
  border-radius: var(--cc-radius-sm);
  background: var(--cc-color-mist);
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 18px;
}
.cc-rp__view {
  align-self: flex-start;
  min-height: 36px;
  padding: 0;
  border: none;
  background: none;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  font-weight: 600;
  color: var(--cc-color-primary);
  text-decoration: underline;
  cursor: pointer;
}
.cc-rp__settled {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
}
</style>
