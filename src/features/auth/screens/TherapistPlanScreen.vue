<template>
  <ion-page>
    <ion-header class="cc-plain-header">
      <ion-toolbar class="cc-plain-header__bar">
        <ion-buttons slot="start"><ion-back-button :default-href="backHref" text="" /></ion-buttons>
        <ion-title>{{ onboarding ? 'Verification · step 2 of 2' : 'Therapist plan' }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <div v-if="onboarding" class="cc-progress-track"><div class="cc-progress-fill" style="width: 100%" /></div>
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <h2 class="cc-text-h1" style="margin: 0 0 6px">
          {{ currentPlanLabel ? 'Change your plan' : 'Choose a therapist plan' }}
        </h2>
        <p class="cc-text-body" style="margin: 0 0 16px; font-size: 12.5px">
          <template v-if="currentPlanLabel">
            You are on the {{ currentPlanLabel }} plan. Purchases stay unlimited on every plan — only
            clients and case files are limited.
          </template>
          <template v-else>
            Purchases stay unlimited on every plan — only clients and case files are limited.
          </template>
        </p>

        <button
          v-for="p in plans"
          :key="p.key"
          type="button"
          class="cc-plan"
          :class="{ 'cc-plan--selected': plan === p.key }"
          @click="plan = p.key"
        >
          <div class="cc-plan__head">
            <div>
              <span class="cc-text-body-strong" style="font-size: 16px">{{ p.name }}</span>
              <AppBadge v-if="p.tag" :label="p.tag" />
            </div>
            <span class="cc-text-mono" style="font-size: 19px; font-weight: 700">{{ p.price }}</span>
          </div>
          <div class="cc-text-body" style="font-size: 12.5px">{{ p.detail }}</div>
        </button>

        <AppCard>
          <div class="cc-text-body-strong" style="font-size: 13.5px; margin-bottom: 9px">What you get</div>
          <div class="cc-feature"><AppIcon name="check_circle" :size="18" color="var(--cc-color-success)" />Case files with notes and attachments</div>
          <div class="cc-feature"><AppIcon name="check_circle" :size="18" color="var(--cc-color-success)" />Chat and video with your clients</div>
          <div class="cc-feature"><AppIcon name="check_circle" :size="18" color="var(--cc-color-success)" />Recommend products and order on their behalf</div>
        </AppCard>
      </div>
      <div class="cc-screen__footer">
        <AppButton :loading="submitting" style="margin-bottom: 9px" @click="onActivate">Activate {{ selectedPlan.name }}</AppButton>
        <p class="cc-text-caption" style="text-align: center">Downgrades keep your data — limits apply again.</p>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppBadge, AppButton, AppCard, AppIcon } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';
import type { TherapistPlanTier } from '@/types/user';

const router = useRouter();
const auth = useAuthStore();
const toast = useToast();

/**
 * Serves two lanes. New therapists arrive mid-onboarding (step 2 of 2) and
 * continue to the completion screen. Existing therapists — including accounts
 * that held the role before plans existed, which the API returns as
 * `{ plan: null, status: 'inactive' }` — arrive from their dashboard or
 * profile and drop straight back into the practice once subscribed.
 */
const onboarding = !auth.roles.includes('therapist') || !auth.user?.therapistProfile;
const backHref = onboarding ? '/profile' : '/therapist/profile';

const plans: { key: TherapistPlanTier; name: string; price: string; detail: string; tag?: string }[] = [
  { key: 'free-trial', name: 'Free trial', price: '$0', detail: '1 client · 1 case file · unlimited purchases' },
  { key: 'monthly', name: 'Monthly', price: '$15/mo', detail: '25 clients · unlimited case files · Point Facility hosting', tag: 'MOST CHOSEN' },
  { key: 'yearly', name: 'Yearly', price: '$200/yr', detail: 'Everything monthly · save $40 · priority assignment' },
];
const currentPlan = computed(() => auth.user?.therapistProfile?.plan ?? null);
const currentPlanLabel = computed(
  () => (auth.therapistPlanActive ? plans.find((p) => p.key === currentPlan.value)?.name : null) ?? null,
);

const plan = ref<TherapistPlanTier>(currentPlan.value ?? 'monthly');
const selectedPlan = computed(() => plans.find((p) => p.key === plan.value)!);
const submitting = ref(false);

async function onActivate() {
  submitting.value = true;
  try {
    await auth.activateTherapist(plan.value);

    if (onboarding) {
      router.replace({ name: 'therapist-onboarding-complete' });
      return;
    }

    router.replace({ name: 'therapist-today' });
    await toast.show(`Your ${selectedPlan.value.name} plan is active. You can take clients now.`, 'success', {
      title: 'Plan activated',
    });
  } catch (e) {
    const message = e instanceof ApiError ? e.message : 'We could not activate that plan. Please try again.';
    await toast.show(message, 'danger', { title: 'Activation failed', dismissLabel: 'Try again' });
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.cc-plain-header {
  box-shadow: none;
}
.cc-plain-header__bar {
  --background: var(--cc-surface-0);
  --border-width: 0;
}
.cc-progress-track {
  height: 5px;
  border-radius: 999px;
  background: var(--cc-color-mist);
  margin: 0 16px 14px;
}
.cc-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--cc-color-primary);
}
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-screen__pad {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-plan {
  background: var(--cc-surface-0);
  border: 1px solid var(--cc-line);
  border-radius: 16px;
  padding: 14px;
  text-align: left;
  cursor: pointer;
}
.cc-plan--selected {
  border: 1.5px solid var(--cc-color-primary);
  box-shadow: 0 4px 14px rgba(14, 124, 107, 0.1);
}
.cc-plan__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}
.cc-feature {
  display: flex;
  gap: 8px;
  align-items: center;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  color: var(--cc-ink-600);
  margin-bottom: 7px;
}
.cc-screen__footer {
  padding: 11px 16px calc(25px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
}
</style>
