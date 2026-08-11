<template>
  <ion-page>
    <AppHeader :title="caseFile?.clientName ?? 'Case file'" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <LoadingState v-if="isPending" label="Loading case file…" />
      <div v-else-if="caseFile" class="cc-screen__pad">
        <AppCard>
          <div class="cc-row"><span class="cc-text-caption">Sessions</span><span class="cc-text-body-strong" style="font-size: 13.5px">{{ caseFile.sessionCount }}</span></div>
          <div class="cc-row"><span class="cc-text-caption">Last session</span><span class="cc-text-body-strong" style="font-size: 13.5px">{{ caseFile.lastSessionAt ? formatDate(caseFile.lastSessionAt) : 'None yet' }}</span></div>
        </AppCard>

        <div class="cc-section-head">
          <span class="cc-text-body-strong" style="font-size: 16px">Notes</span>
        </div>
        <AppCard v-for="n in caseFile.notes" :key="n.id" class="cc-note">
          <p class="cc-text-body" style="margin: 0 0 6px">{{ n.body }}</p>
          <div class="cc-text-caption">{{ formatDate(n.createdAt) }} <span v-if="n.draft">· draft — locks once the session is marked complete</span></div>
        </AppCard>
        <textarea v-model="draftNote" class="cc-textarea" rows="3" placeholder="Add a session note" />
        <AppButton variant="secondary" :loading="savingNote" @click="onAddNote">Save note</AppButton>

        <section class="cc-recommendations" aria-labelledby="recommendations-title">
          <div class="cc-recommendations__heading">
            <div>
              <h2 id="recommendations-title">Recommendations</h2>
              <p>Products suggested for this client’s care.</p>
            </div>
            <button type="button" class="cc-recommendations__add" @click="router.push({ name: 'catalog' })">
              <AppIcon name="add" :size="18" />
              Add
            </button>
          </div>

          <div v-if="!caseFile.recommendations.length" class="cc-recommendations__empty">
            <AppIcon name="spa" :size="22" color="var(--cc-color-primary)" />
            <span>No products recommended yet.</span>
          </div>

          <AppCard v-for="r in caseFile.recommendations" :key="r.id" class="cc-reco">
            <div class="cc-reco__top">
              <div class="cc-reco__product-icon">
                <AppIcon name="local_pharmacy" :size="22" color="var(--cc-color-primary)" />
              </div>
              <div class="cc-reco__product">
                <span class="cc-text-mono">CARE RECOMMENDATION</span>
                <h3>{{ r.productName }}</h3>
              </div>
              <AppBadge :label="r.orderId ? 'ORDERED' : 'SUGGESTED'" :tone="r.orderId ? 'success' : 'default'" />
            </div>

            <div v-if="r.note" class="cc-reco__guidance">
              <AppIcon name="info" :size="18" color="var(--cc-color-primary)" />
              <div>
                <span>Suggested use</span>
                <p>{{ r.note }}</p>
              </div>
            </div>

            <div class="cc-reco__footer">
              <span>{{ r.orderId ? 'Added to an order' : 'Awaiting client order' }}</span>
              <AppButton
                variant="secondary"
                :full-width="false"
                @click="router.push({ name: 'product-detail', params: { id: r.productId } })"
              >
                View product
              </AppButton>
            </div>
          </AppCard>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppBadge, AppButton, AppCard, AppHeader, AppIcon } from '@/components/ui';
import { LoadingState } from '@/components/state';
import { caseFilesApi } from '@/api/case-files.api';
import { useCaseFile } from '@/composables/useCaseFiles';

/** TD5 · Session notes — draft state, lock rule stated inline. */
const route = useRoute();
const router = useRouter();
const id = route.params.id as string;
const { data: caseFile, isPending, refetch } = useCaseFile(id);

const draftNote = ref('');
const savingNote = ref(false);

async function onAddNote() {
  if (!draftNote.value.trim()) return;
  savingNote.value = true;
  try {
    await caseFilesApi.addNote(id, draftNote.value.trim(), true);
    draftNote.value = '';
    await refetch();
  } finally {
    savingNote.value = false;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}
.cc-section-head {
  margin-top: 6px;
}
.cc-textarea {
  width: 100%;
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-sm);
  padding: 10px 12px;
  font-family: var(--cc-font-interface);
  font-size: 13.5px;
  box-sizing: border-box;
  resize: vertical;
}
.cc-recommendations {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 6px;
}
.cc-recommendations__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.cc-recommendations__heading h2 {
  margin: 0;
  color: var(--cc-ink-900);
  font-family: var(--cc-font-interface);
  font-size: 16px;
  line-height: 22px;
}
.cc-recommendations__heading p {
  margin: 2px 0 0;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 16px;
}
.cc-recommendations__add {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-height: 34px;
  padding: 0 8px;
  border: none;
  border-radius: var(--cc-radius-sm);
  background: var(--cc-color-mist);
  color: var(--cc-color-primary-dark);
  font-family: var(--cc-font-interface);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.cc-recommendations__empty {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 14px;
  border: 1px dashed var(--cc-line);
  border-radius: var(--cc-radius-md);
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
}
.cc-reco {
  padding: 14px;
}
.cc-reco__top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cc-reco__product-icon {
  width: 42px;
  height: 42px;
  display: grid;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: var(--cc-color-mist);
}
.cc-reco__product {
  min-width: 0;
  flex: 1;
}
.cc-reco__product .cc-text-mono {
  display: block;
  margin-bottom: 2px;
  color: var(--cc-ink-400);
  font-size: 9.5px;
  line-height: 14px;
  letter-spacing: 0.06em;
}
.cc-reco__product h3 {
  margin: 0;
  overflow: hidden;
  color: var(--cc-ink-900);
  font-family: var(--cc-font-interface);
  font-size: 14px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cc-reco__guidance {
  display: flex;
  gap: 8px;
  margin-top: 13px;
  padding: 10px;
  border-radius: 10px;
  background: var(--cc-surface-1);
}
.cc-reco__guidance > div {
  min-width: 0;
}
.cc-reco__guidance span {
  display: block;
  margin-bottom: 2px;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 10.5px;
  font-weight: 600;
}
.cc-reco__guidance p {
  margin: 0;
  color: var(--cc-ink-900);
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  line-height: 18px;
}
.cc-reco__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--cc-divider);
}
.cc-reco__footer > span {
  color: var(--cc-ink-400);
  font-family: var(--cc-font-interface);
  font-size: 10.5px;
  line-height: 15px;
}
.cc-reco__footer :deep(.cc-btn) {
  min-height: 36px;
  padding: 0 12px;
  white-space: nowrap;
}
</style>
