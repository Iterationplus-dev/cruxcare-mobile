<template>
  <AppSheet v-model="open" title="Switch context">
    <p class="cc-text-caption" style="margin: 0 0 16px">
      Your wallet is shared across roles. Navigation and permissions change.
    </p>

    <div class="cc-roles">
      <button
        v-if="hasMember"
        type="button"
        class="cc-role"
        :class="{ 'cc-role--active': selectedRole === 'member' }"
        @click="select('member')"
      >
        <AppIcon name="person" :size="22" :color="iconColor('member')" />
        <div class="cc-role__body">
          <div class="cc-text-body-strong" style="font-size: 14.5px">Member</div>
          <div class="cc-text-caption">Grow, wallet and network</div>
        </div>
        <AppIcon v-if="selectedRole === 'member'" name="check_circle" :size="20" color="var(--cc-color-primary)" />
      </button>

      <button
        type="button"
        class="cc-role"
        :class="{ 'cc-role--active': selectedRole === 'client' }"
        @click="select('client')"
      >
        <AppIcon name="health_and_safety" :size="22" :color="iconColor('client')" />
        <div class="cc-role__body">
          <div class="cc-text-body-strong" style="font-size: 14.5px">Client</div>
          <div class="cc-text-caption">Shop, care and wallet</div>
        </div>
        <AppIcon v-if="selectedRole === 'client'" name="check_circle" :size="20" color="var(--cc-color-primary)" />
      </button>

      <button
        v-if="hasAdmin"
        type="button"
        class="cc-role"
        :class="{ 'cc-role--active': selectedRole === 'admin' }"
        @click="select('admin')"
      >
        <AppIcon name="admin_panel_settings" :size="22" :color="iconColor('admin')" />
        <div class="cc-role__body">
          <div class="cc-text-body-strong" style="font-size: 14.5px">Administrator</div>
          <div class="cc-text-caption">Approvals, people and monitoring</div>
        </div>
        <AppIcon v-if="selectedRole === 'admin'" name="check_circle" :size="20" color="var(--cc-color-primary)" />
      </button>

      <button
        type="button"
        class="cc-role"
        :class="{ 'cc-role--active': selectedRole === 'therapist', 'cc-role--disabled': !hasTherapist }"
        @click="hasTherapist ? select('therapist') : goActivate()"
      >
        <AppIcon name="medical_services" :size="22" :color="hasTherapist ? iconColor('therapist') : 'var(--cc-ink-300)'" />
        <div class="cc-role__body">
          <div class="cc-text-body-strong" :style="{ fontSize: '14.5px', color: hasTherapist ? undefined : 'var(--cc-ink-300)' }">Therapist</div>
          <div class="cc-text-caption">{{ hasTherapist ? 'Clients, calendar and earnings' : 'No active plan on this account' }}</div>
        </div>
        <AppIcon v-if="selectedRole === 'therapist'" name="check_circle" :size="20" color="var(--cc-color-primary)" />
        <span v-else-if="!hasTherapist" class="cc-role__activate">Activate</span>
      </button>
    </div>

    <div class="cc-roles__notice">
      <AppIcon name="info" :size="20" color="var(--cc-color-primary)" />
      <p>Switching does not sign you out or move any money.</p>
    </div>

    <AppButton style="margin-bottom: 8px" @click="continueAsSelected">Continue as {{ roleLabel }}</AppButton>
    <button v-if="selectedRole !== auth.activeRole" type="button" class="cc-roles__stay" @click="selectedRole = auth.activeRole">
      Stay as {{ activeRoleLabel }}
    </button>
  </AppSheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { AppButton, AppIcon, AppSheet } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';
import type { Role } from '@/types/user';

const open = defineModel<boolean>({ required: true });
const auth = useAuthStore();
const router = useRouter();
const selectedRole = ref<Role>(auth.activeRole);

const hasMember = computed(() => auth.roles.includes('member'));
const hasTherapist = computed(() => auth.roles.includes('therapist'));
const hasAdmin = computed(() => auth.roles.includes('admin'));
const roleLabel = computed(() => formatRole(selectedRole.value));
const activeRoleLabel = computed(() => formatRole(auth.activeRole));

watch(open, (isOpen) => {
  if (isOpen) selectedRole.value = auth.activeRole;
});

function select(role: Role) {
  selectedRole.value = role;
}

function continueAsSelected() {
  auth.setActiveRole(selectedRole.value);
  open.value = false;
  router.replace({ name: homeForRole(selectedRole.value) });
}

function goActivate() {
  open.value = false;
  router.push({ name: 'become-therapist' });
}

function homeForRole(role: Role) {
  if (role === 'therapist') return 'therapist-today';
  if (role === 'member') return 'tabs-member-home';
  if (role === 'admin') return 'admin-approvals';
  return 'tabs-home';
}

function iconColor(role: Role) {
  return selectedRole.value === role ? 'var(--cc-color-primary)' : 'var(--cc-ink-600)';
}

function formatRole(role: Role) {
  return role.slice(0, 1).toUpperCase() + role.slice(1);
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
  border-radius: var(--cc-radius-lg);
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
  color: var(--cc-color-primary);
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  font-weight: 600;
}
.cc-roles__notice {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: var(--cc-radius-md);
  background: var(--cc-color-mist);
}
.cc-roles__notice p {
  margin: 0;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 17px;
}
.cc-roles__stay {
  display: block;
  width: 100%;
  min-height: var(--cc-textbutton-height);
  border: none;
  background: transparent;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
</style>
