<template>
  <AppSheet v-model="open" title="Switch context">
    <p class="cc-text-caption" style="margin: 0 0 16px">
      Your wallet is shared across roles. Navigation and permissions change.
    </p>
    <div class="cc-roles">
      <button
        type="button"
        class="cc-role"
        :class="{ 'cc-role--active': auth.activeRole === 'client' }"
        @click="select('client')"
      >
        <AppIcon name="health_and_safety" :size="22" :color="auth.activeRole === 'client' ? 'var(--cc-color-primary)' : 'var(--cc-ink-600)'" />
        <div class="cc-role__body">
          <div class="cc-text-body-strong" style="font-size: 14px">Client</div>
          <div class="cc-text-caption">Shop, care and wallet</div>
        </div>
        <AppIcon v-if="auth.activeRole === 'client'" name="check_circle" :size="20" color="var(--cc-color-primary)" />
      </button>

      <button
        type="button"
        class="cc-role"
        :class="{ 'cc-role--active': auth.activeRole === 'therapist', 'cc-role--disabled': !hasTherapist }"
        @click="hasTherapist ? select('therapist') : goActivate()"
      >
        <AppIcon name="medical_services" :size="22" :color="hasTherapist ? (auth.activeRole === 'therapist' ? 'var(--cc-color-primary)' : 'var(--cc-ink-600)') : 'var(--cc-ink-300)'" />
        <div class="cc-role__body">
          <div class="cc-text-body-strong" :style="{ fontSize: '14px', color: hasTherapist ? undefined : 'var(--cc-ink-300)' }">Therapist</div>
          <div class="cc-text-caption">{{ hasTherapist ? 'Clients, calendar and earnings' : 'No active plan on this account' }}</div>
        </div>
        <AppIcon v-if="auth.activeRole === 'therapist'" name="check_circle" :size="20" color="var(--cc-color-primary)" />
        <span v-else-if="!hasTherapist" class="cc-role__activate">Activate</span>
      </button>
    </div>

    <div class="cc-roles__notice">
      <AppIcon name="info" :size="20" color="var(--cc-color-primary)" />
      <p>Switching doesn't sign you out or move any money.</p>
    </div>

    <AppButton style="margin-bottom: 8px" @click="open = false">Continue as {{ roleLabel }}</AppButton>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { AppButton, AppIcon, AppSheet } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import type { Role } from '@/types/user';

const open = defineModel<boolean>({ required: true });
const auth = useAuthStore();
const router = useRouter();

const hasTherapist = computed(() => auth.roles.includes('therapist'));
const roleLabel = computed(() => (auth.activeRole === 'client' ? 'Client' : 'Therapist'));

function select(role: Role) {
  auth.setActiveRole(role);
  open.value = false;
  router.replace({ name: role === 'therapist' ? 'therapist-today' : 'tabs-home' });
}

function goActivate() {
  open.value = false;
  router.push({ name: 'become-therapist' });
}
</script>

<style scoped>
.cc-roles {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}
.cc-role {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--cc-line);
  border-radius: 14px;
  background: var(--cc-surface-0);
  cursor: pointer;
  text-align: left;
}
.cc-role--active {
  border: 1.5px solid var(--cc-color-primary);
  background: var(--cc-color-mist);
}
.cc-role--disabled {
  background: var(--cc-surface-app);
  border-color: var(--cc-divider);
}
.cc-role__body {
  flex: 1;
}
.cc-role__activate {
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 11px;
  color: var(--cc-color-primary);
}
.cc-roles__notice {
  display: flex;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--cc-color-mist);
  margin-bottom: 16px;
}
.cc-roles__notice p {
  margin: 0;
  font-family: var(--cc-font-interface);
  font-size: 11px;
  line-height: 16px;
  color: var(--cc-ink-600);
}
</style>
