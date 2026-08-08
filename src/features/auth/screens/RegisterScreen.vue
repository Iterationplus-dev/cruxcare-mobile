<template>
  <ion-page>
    <AppHeader title="Create account" show-back :botanical="false" />
    <ion-content class="cc-screen">
      <div class="cc-screen__pad">
        <h2 class="cc-text-h1" style="margin: 0 0 4px">Start with the basics</h2>
        <p class="cc-text-subtitle" style="margin: 0 0 16px">
          You can shop straight away. Your care profile comes later, only if you book a therapist.
        </p>

        <div class="cc-form-row">
          <AppInput v-model="firstName" label="First name" autocomplete="given-name" :error="errors.firstName" />
          <AppInput v-model="lastName" label="Last name" autocomplete="family-name" :error="errors.lastName" />
        </div>

        <AppInput
          v-model="email"
          label="Email"
          type="email"
          inputmode="email"
          autocomplete="email"
          :error="errors.email"
        />

        <AppInput v-model="phone" label="Phone" inputmode="tel" autocomplete="tel" :error="errors.phone">
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
        <AppSelect
          v-model="referredBySource"
          label="How did you hear about CruxCare?"
          placeholder="Select one"
          :options="referredByOptions"
          :error="errors.referredBySource"
        />

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
          <span class="cc-text-body" style="font-size: 12px; line-height: 18px">
            I agree to the <a href="#" @click.prevent>Terms of Service</a> and
            <a href="#" @click.prevent>Privacy Policy</a>.
          </span>
        </label>
        <p v-if="errors.consent" class="cc-field__error" role="alert">{{ errors.consent }}</p>

        <p v-if="formError" class="cc-field__error" role="alert" style="margin-top: 12px">{{ formError }}</p>
      </div>

      <div class="cc-screen__footer">
        <AppButton :loading="submitting" @click="onSubmit">Create account</AppButton>
        <div class="cc-text-body" style="text-align: center; font-size: 12px">
          Already have an account?
          <a href="#" @click.prevent="router.push({ name: 'login' })">Log in</a>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import AppHeader from '@/components/ui/AppHeader.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppSelect from '@/components/ui/AppSelect.vue';
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
}
.cc-phone-prefix {
  font-family: var(--cc-font-interface);
  font-size: 14px;
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
  font-size: 11px;
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
  font-size: 11px;
  color: var(--cc-error-surface-text);
  margin: 4px 0 0;
}
.cc-screen__footer {
  padding: 11px 16px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
