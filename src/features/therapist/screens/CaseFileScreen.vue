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

        <div class="cc-section-head">
          <span class="cc-text-body-strong" style="font-size: 16px">Recommendations</span>
        </div>
        <AppCard v-for="r in caseFile.recommendations" :key="r.id" class="cc-reco">
          <div class="cc-reco__body">
            <div class="cc-text-body-strong" style="font-size: 13.5px">{{ r.productName }}</div>
            <div class="cc-text-caption">{{ r.note }}</div>
          </div>
          <AppButton variant="secondary" @click="router.push({ name: 'product-detail', params: { id: r.productId } })">View</AppButton>
        </AppCard>
        <AppButton variant="secondary" @click="router.push({ name: 'catalog' })">Recommend a product</AppButton>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRoute, useRouter } from 'vue-router';
import { AppButton, AppCard, AppHeader } from '@/components/ui';
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
.cc-reco {
  display: flex;
  gap: 12px;
  align-items: center;
}
.cc-reco__body {
  flex: 1;
}
</style>
