<template>
  <ion-page>
    <ion-content class="cc-screen">
      <div class="cc-register__topbar">
        <button type="button" class="cc-register__back" aria-label="Back" @click="router.back()">
          <AppIcon name="arrow_back_ios_new" :size="24" color="var(--cc-color-primary)" />
        </button>
        <span class="cc-text-body-strong" style="font-size: 14.5px">Create account</span>
      </div>
      <div class="cc-screen__pad">
        <h2 class="cc-text-h1" style="margin: 0 0 4px">Start with the basics</h2>
        <p class="cc-text-subtitle" style="margin: 0 0 16px">
          You can shop straight away. Your care profile comes later, only if you book a therapist.
        </p>

        <div class="cc-form-row">
          <AppInput
            v-model="firstName"
            label="First name"
            placeholder="Amara"
            autocomplete="given-name"
            :error="errors.firstName"
          />
          <AppInput
            v-model="lastName"
            label="Last name"
            placeholder="Okafor"
            autocomplete="family-name"
            :error="errors.lastName"
          />
        </div>

        <AppInput
          v-model="email"
          label="Email"
          type="email"
          placeholder="amara.okafor@gmail.com"
          inputmode="email"
          autocomplete="email"
          :error="errors.email"
        />

        <AppInput
          v-model="phone"
          label="Phone"
          placeholder="803 214 8890"
          inputmode="tel"
          autocomplete="tel"
          :error="errors.phone"
        >
          <template #leading>
            <span class="cc-phone-prefix">+234</span>
          </template>
        </AppInput>

        <!--
          Referred-by source: required by PRD A1 acceptance criteria but not
          drawn as a field on CA2 (which shows six fields). Added as a
          compact select to satisfy the functional requirement without
          disrupting the drawn layout's density — see CLAUDE.md guidance on
          documenting and resolving spec conflicts.
        -->
        <div class="cc-field">
          <label class="cc-field__label">How did you hear about CruxCare?</label>
          <button
            type="button"
            class="cc-referral-trigger"
            :class="{ 'cc-referral-trigger--error': !!errors.referredBySource }"
            @click="referralSheetOpen = true"
          >
            <span :class="referredBySource ? 'cc-text-body' : 'cc-referral-trigger__placeholder'" style="font-size: 14.5px">
              {{ selectedReferralLabel ?? 'Select one' }}
            </span>
            <AppIcon name="expand_more" :size="18" color="var(--cc-ink-400)" />
          </button>
          <p v-if="errors.referredBySource" class="cc-field__error" role="alert">{{ errors.referredBySource }}</p>
        </div>

        <AppInput
          v-model="password"
          label="Password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="new-password"
          :error="errors.password"
        >
          <template #trailing>
            <button type="button" class="cc-visibility-toggle" @click="showPassword = !showPassword">
              <AppIcon :name="showPassword ? 'visibility' : 'visibility_off'" :size="20" color="var(--cc-ink-400)" />
            </button>
          </template>
        </AppInput>
        <div class="cc-strength" role="status">
          <span
            v-for="i in 4"
            :key="i"
            class="cc-strength__bar"
            :class="{ 'cc-strength__bar--filled': i <= strength.score }"
          />
        </div>
        <p class="cc-text-caption" style="margin: 5px 0 12px">
          {{ strength.label }} · 8+ characters, one number
        </p>

        <AppInput
          v-model="confirmPassword"
          label="Confirm password"
          :type="showConfirm ? 'text' : 'password'"
          autocomplete="new-password"
          :error="errors.confirmPassword"
        >
          <template #trailing>
            <button type="button" class="cc-visibility-toggle" @click="showConfirm = !showConfirm">
              <AppIcon :name="showConfirm ? 'visibility' : 'visibility_off'" :size="20" color="var(--cc-ink-400)" />
            </button>
          </template>
        </AppInput>
        <div
          v-if="confirmPassword"
          class="cc-match"
          :class="{ 'cc-match--ok': password === confirmPassword }"
        >
          <AppIcon
            :name="password === confirmPassword ? 'check_circle' : 'error'"
            :size="14"
            :color="password === confirmPassword ? 'var(--cc-color-success-text)' : 'var(--cc-error-surface-text)'"
          />
          {{ password === confirmPassword ? 'Passwords match' : 'Passwords do not match' }}
        </div>

        <label class="cc-consent">
          <input v-model="consent" type="checkbox" class="cc-consent__box" />
          <span class="cc-text-body" style="font-size: 12.5px; line-height: 19px">
            I agree to the <a href="#" @click.prevent>Terms of Service</a> and
            <a href="#" @click.prevent>Privacy Policy</a>.
          </span>
        </label>
        <p v-if="errors.consent" class="cc-field__error" role="alert">{{ errors.consent }}</p>

        <p v-if="formError" class="cc-field__error" role="alert" style="margin-top: 12px">{{ formError }}</p>
      </div>

      <div class="cc-screen__footer">
        <AppButton :loading="submitting" @click="onSubmit">Create account</AppButton>
        <div class="cc-text-body" style="text-align: center; font-size: 12.5px">
          Already have an account?
          <a href="#" @click.prevent="router.push({ name: 'login' })">Log in</a>
        </div>
      </div>
    </ion-content>

    <AppSheet v-model="referralSheetOpen" title="How did you hear about CruxCare?">
      <div class="cc-referral-options">
        <button
          v-for="opt in referredByOptions"
          :key="opt.value"
          type="button"
          class="cc-referral-option"
          :class="{ 'cc-referral-option--selected': referredBySource === opt.value }"
          @click="selectReferral(opt.value)"
        >
          <span class="cc-text-body" style="font-size: 14.5px">{{ opt.label }}</span>
          <AppIcon
            v-if="referredBySource === opt.value"
            name="check_circle"
            :size="20"
            color="var(--cc-color-primary)"
          />
        </button>
      </div>
    </AppSheet>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppSheet from '@/components/ui/AppSheet.vue';
import { useAuthStore } from '@/stores/auth';
import { ApiError } from '@/types/api';
import {
  passwordStrength,
  referredBySourceOptions,
  registerSchema,
} from '../schemas/register.schema';
import type { ReferredBySource } from '@/types/user';

const router = useRouter();
const auth = useAuthStore();

const { defineField, errors, handleSubmit } = useForm({
  validationSchema: toTypedSchema(registerSchema),
  initialValues: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    referredBySource: '' as ReferredBySource,
    password: '',
    confirmPassword: '',
    consent: false as unknown as true,
  },
});

const [firstName] = defineField('firstName');
const [lastName] = defineField('lastName');
const [email] = defineField('email');
const [phone] = defineField('phone');
const [referredBySource] = defineField('referredBySource');
const [password] = defineField('password');
const [confirmPassword] = defineField('confirmPassword');
const [consent] = defineField('consent');

const showPassword = ref(false);
const showConfirm = ref(false);
const submitting = ref(false);
const formError = ref('');

const referredByOptions: { value: string; label: string }[] = referredBySourceOptions.map((o) => ({
  value: o.value,
  label: o.label,
}));

const referralSheetOpen = ref(false);
const selectedReferralLabel = computed(
  () => referredByOptions.find((o) => o.value === referredBySource.value)?.label,
);
function selectReferral(value: string) {
  referredBySource.value = value as ReferredBySource;
  referralSheetOpen.value = false;
}

const strength = ref(passwordStrength(''));
watch(password, (v) => (strength.value = passwordStrength(v ?? '')));

const onSubmit = handleSubmit(async (values) => {
  submitting.value = true;
  formError.value = '';
  try {
    const phone = `+234${values.phone}`;
    await auth.register({
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone,
      password: values.password,
      referredBySource: values.referredBySource as ReferredBySource,
    });
    // CA3 — signup OTP verification precedes the role-appropriate home (A3).
    router.replace({
      name: 'register-otp',
      query: { purpose: 'signup', contact: phone, redirect: 'health-profile-gate' },
    });
  } catch (e) {
    formError.value = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
  } finally {
    submitting.value = false;
  }
});
</script>

<style scoped>
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-register__topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  padding: calc(env(safe-area-inset-top) + 0px) 8px 0 12px;
  box-sizing: content-box;
}
.cc-register__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  margin-left: -10px;
  background: none;
  border: none;
  cursor: pointer;
}
.cc-screen__pad {
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-form-row {
  display: flex;
  gap: 8px;
}
.cc-form-row > * {
  flex: 1;
  min-width: 0;
}
.cc-phone-prefix {
  font-family: var(--cc-font-interface);
  font-size: 14.5px;
  color: var(--cc-ink-900);
  padding-right: 8px;
  border-right: 1px solid var(--cc-line);
}
.cc-visibility-toggle {
  background: none;
  border: none;
  padding: 0;
  display: flex;
  cursor: pointer;
}
.cc-strength {
  display: flex;
  gap: 4px;
}
.cc-strength__bar {
  flex: 1;
  height: 4px;
  border-radius: var(--cc-radius-pill);
  background: var(--cc-divider);
}
.cc-strength__bar--filled {
  background: var(--cc-color-success);
}
.cc-match {
  display: flex;
  align-items: center;
  gap: 4px;
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  color: var(--cc-error-surface-text);
  margin-top: -4px;
}
.cc-match--ok {
  color: var(--cc-color-success-text);
}
.cc-consent {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  margin-top: 4px;
  cursor: pointer;
}
.cc-consent__box {
  width: 20px;
  height: 20px;
  accent-color: var(--cc-color-primary);
  flex-shrink: 0;
  margin-top: 1px;
}
.cc-field__error {
  font-family: var(--cc-font-interface);
  font-weight: 500;
  font-size: 11.5px;
  color: var(--cc-error-surface-text);
  margin: 4px 0 0;
}
.cc-field {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.cc-field__label {
  font-family: var(--cc-font-interface);
  font-weight: 600;
  font-size: 13.5px;
  line-height: 20px;
  color: var(--cc-ink-900);
  margin-bottom: 4px;
}
.cc-referral-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--cc-input-height);
  border: 1px solid var(--cc-line);
  border-radius: var(--cc-radius-sm);
  padding: 0 12px;
  background: var(--cc-surface-0);
  cursor: pointer;
  text-align: left;
}
.cc-referral-trigger--error {
  border: 1.5px solid var(--cc-input-error-border);
  background: var(--cc-error-surface);
}
.cc-referral-trigger__placeholder {
  font-family: var(--cc-font-interface);
  color: var(--cc-ink-300);
}
.cc-referral-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
  max-height: 50vh;
  overflow-y: auto;
}
.cc-referral-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 48px;
  padding: 0 14px;
  border-radius: var(--cc-radius-md);
  border: 1px solid var(--cc-line);
  background: var(--cc-surface-0);
  cursor: pointer;
}
.cc-referral-option--selected {
  border: 1.5px solid var(--cc-color-primary);
  background: var(--cc-color-mist);
}
.cc-screen__footer {
  padding: 11px 16px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
