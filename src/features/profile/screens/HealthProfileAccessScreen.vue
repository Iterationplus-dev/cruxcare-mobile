<template>
  <ion-page>
    <AppHeader title="Health profile access" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <LoadingState v-if="isPending" label="Loading who has access…" />

        <ErrorState
          v-else-if="isError"
          title="We could not load this"
          message="Nothing has been changed. Check your connection and try again."
        >
          <template #actions>
            <AppButton variant="secondary" @click="refetch()">Try again</AppButton>
          </template>
        </ErrorState>

        <template v-else>
          <p class="cc-access__intro">
            A therapist has to ask before they can read your health profile. You decide, and you can
            take it back at any time.
          </p>

          <template v-if="pending.length">
            <AppSectionLabel label="Waiting for your answer" />
            <AppCard v-for="row in pending" :key="row.id" class="cc-access__card">
              <div class="cc-access__head">
                <AppAvatar :name="row.therapistName ?? 'Therapist'" :size="40" />
                <div class="cc-access__who">
                  <div class="cc-text-body-strong" style="font-size: 14.5px">
                    {{ row.therapistName ?? 'Your therapist' }}
                  </div>
                  <div class="cc-text-caption">Asked {{ formatDate(row.requestedAt) }}</div>
                </div>
              </div>
              <div class="cc-access__actions">
                <AppButton :loading="busyId === row.id" @click="decide(row, 'grant')">Allow</AppButton>
                <AppButton
                  variant="secondary"
                  :loading="busyId === row.id"
                  @click="decide(row, 'revoke')"
                >
                  Refuse
                </AppButton>
              </div>
            </AppCard>
          </template>

          <AppSectionLabel label="Has access" />
          <AppCard v-if="granted.length" style="padding: 0">
            <AppListRow
              v-for="(row, i) in granted"
              :key="row.id"
              :title="row.therapistName ?? 'Your therapist'"
              :subtitle="`Allowed ${formatDate(row.respondedAt ?? row.requestedAt)}`"
              icon="medical_information"
              :divider="i !== granted.length - 1"
            >
              <template #trailing>
                <button
                  type="button"
                  class="cc-access__revoke"
                  :disabled="busyId === row.id"
                  @click="decide(row, 'revoke')"
                >
                  Remove
                </button>
              </template>
            </AppListRow>
          </AppCard>
          <AppCard v-else style="padding: 0">
            <AppListRow
              title="No one has access"
              subtitle="Nobody can read your health profile right now"
              icon="lock"
              :divider="false"
            />
          </AppCard>

          <template v-if="refused.length">
            <AppSectionLabel label="Not allowed" />
            <AppCard style="padding: 0">
              <AppListRow
                v-for="(row, i) in refused"
                :key="row.id"
                :title="row.therapistName ?? 'Your therapist'"
                subtitle="You have not given this therapist access"
                icon="block"
                :divider="i !== refused.length - 1"
              >
                <template #trailing>
                  <button
                    type="button"
                    class="cc-access__allow"
                    :disabled="busyId === row.id"
                    @click="decide(row, 'grant')"
                  >
                    Allow
                  </button>
                </template>
              </AppListRow>
            </AppCard>
          </template>

          <p class="cc-text-caption">
            Access also ends on its own when your care with a therapist does, even if you never
            remove it here.
          </p>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import {
  AppAvatar,
  AppButton,
  AppCard,
  AppHeader,
  AppListRow,
  AppSectionLabel,
} from '@/components/ui';
import { ErrorState, LoadingState } from '@/components/state';
import { healthAccessApi } from '@/api/health-access.api';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';
import type { HealthProfileAccess } from '@/types/care';

/**
 * Where PR4's "Health profile access" row leads.
 *
 * The server chose that acceptance of a care request permits a therapist to
 * *ask*, not to read. Until this screen existed the question had nowhere to
 * land: a therapist could request access and the client could neither see it
 * nor answer it.
 */
const toast = useToast();
const queryClient = useQueryClient();
const busyId = ref<string | null>(null);

const {
  data: rows,
  isPending,
  isError,
  refetch,
} = useQuery({
  queryKey: ['health-profile', 'access'],
  queryFn: () => healthAccessApi.list(),
});

const pending = computed(() => (rows.value ?? []).filter((r) => r.status === 'pending'));
const granted = computed(() => (rows.value ?? []).filter((r) => r.status === 'granted'));
const refused = computed(() => (rows.value ?? []).filter((r) => r.status === 'revoked'));

function formatDate(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function decide(row: HealthProfileAccess, action: 'grant' | 'revoke') {
  busyId.value = row.id;
  try {
    await healthAccessApi[action](row.id);
    await queryClient.invalidateQueries({ queryKey: ['health-profile'] });

    const who = row.therapistName ?? 'Your therapist';
    await toast.show(
      action === 'grant'
        ? `${who} can now read your health profile.`
        : `${who} can no longer read your health profile.`,
      'success',
    );
  } catch (error) {
    const message =
      error instanceof ApiError
        ? error.message
        : 'We could not save that. Check your connection and try again.';
    // Nothing is changed locally first, so a failure leaves the screen showing
    // what the server still holds rather than a decision that did not land.
    await toast.show(message, 'danger', { title: 'Not saved' });
  } finally {
    busyId.value = null;
  }
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
.cc-access__intro {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cc-ink-600);
}
.cc-access__card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cc-access__head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cc-access__who {
  flex: 1;
  min-width: 0;
}
.cc-access__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.cc-access__revoke,
.cc-access__allow {
  min-height: 44px;
  padding: 0 4px;
  border: none;
  background: none;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.cc-access__revoke {
  color: var(--cc-color-danger);
}
.cc-access__allow {
  color: var(--cc-color-primary);
}
</style>
