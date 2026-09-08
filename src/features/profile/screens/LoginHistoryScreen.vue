<template>
  <ion-page>
    <AppHeader title="Login history" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <LoadingState v-if="isPending" label="Loading your sign-ins…" />

        <ErrorState
          v-else-if="isError"
          title="We could not load your history"
          message="Check your connection and try again."
        >
          <template #actions>
            <AppButton variant="secondary" @click="refetch()">Try again</AppButton>
          </template>
        </ErrorState>

        <EmptyState
          v-else-if="!events?.length"
          icon="history"
          title="Nothing recorded yet"
          message="Sign-ins appear here from now on."
        />

        <template v-else>
          <!-- Failed attempts are the point of a list like this, so they are
               not filtered out and are marked rather than left to be spotted. -->
          <p class="cc-history__intro">
            Sign-ins to your account, including attempts that failed.
          </p>

          <AppCard style="padding: 0">
            <AppListRow
              v-for="(event, i) in events"
              :key="event.id"
              :title="formatAt(event.at)"
              :subtitle="detailFor(event)"
              :icon="succeeded(event) ? 'login' : 'gpp_maybe'"
              :icon-color="succeeded(event) ? 'var(--cc-color-primary)' : 'var(--cc-color-warning-text)'"
              :subtitle-tone="succeeded(event) ? 'default' : 'warning'"
              :divider="i !== events.length - 1"
            />
          </AppCard>
        </template>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { useQuery } from '@tanstack/vue-query';
import { AppButton, AppCard, AppHeader, AppListRow } from '@/components/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/state';
import { securityApi, type LoginEvent } from '@/api/security.api';
import { loginSucceeded } from '@/features/profile/loginHistory';

/** Where PR4's Login history row leads. */
const {
  data: events,
  isPending,
  isError,
  refetch,
} = useQuery({
  queryKey: ['me', 'login-history'],
  queryFn: () => securityApi.loginHistory(),
});

function succeeded(event: LoginEvent): boolean {
  return loginSucceeded(event.outcome);
}

function formatAt(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return 'At an unknown time';
  return at.toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function detailFor(event: LoginEvent): string {
  const parts = [
    succeeded(event) ? 'Signed in' : 'Failed attempt',
    event.device || null,
    event.ip || null,
  ].filter(Boolean);

  return parts.join(' · ');
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
.cc-history__intro {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cc-ink-600);
}
</style>
