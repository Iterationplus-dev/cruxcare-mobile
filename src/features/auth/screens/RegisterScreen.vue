<template>
  <ion-page>
    <ion-header class="cc-register__header">
      <div class="cc-register__topbar">
        <button type="button" class="cc-register__back" aria-label="Back" @click="router.back()">
          <AppIcon name="arrow_back_ios_new" :size="24" color="var(--cc-color-primary)" />
        </button>
        <span class="cc-text-body-strong" style="font-size: 14.5px">Create account</span>
      </div>
    </ion-header>
    <ion-content class="cc-screen">
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
        <!-- Country, then state, then city — each narrowing the one below.
             Optional throughout: nobody is stopped from registering for
             withholding where they are. -->
        <div class="cc-register__locate">
          <AppButton variant="secondary" :loading="locating" @click="useMyLocation">
            {{ coordinates ? 'Location shared' : 'Use my current location' }}
          </AppButton>
          <p class="cc-text-caption cc-register__locate-note">
            {{ locationNote }}
          </p>
        </div>

        <AppSheetSelect
          v-if="countryOptions.length"
          v-model="countryId"
          label="Country (optional)"
          title="Where are you?"
          placeholder="Select your country"
          :options="countryOptions"
          clearable
          clear-label="Remove my location"
        />
        <!-- The active-country list is only readable once signed in, and this
             screen is not. Until a public list exists the field asks rather
             than offering an empty menu. -->
        <AppInput
          v-else
          v-model="country"
          label="Country (optional)"
          placeholder="Nigeria"
          autocomplete="country-name"
          :error="errors.country"
        />

        <template v-if="countryId || country">
          <AppSheetSelect
            v-if="stateOptions.length"
            v-model="stateId"
            label="State (optional)"
            title="Select your state"
            placeholder="Select your state"
            :options="stateOptions"
          />
          <!-- No list for this country yet, so the field asks rather than
               offering an empty menu that cannot be answered. -->
          <AppInput
            v-else
            v-model="state"
            label="State (optional)"
            placeholder="Akwa Ibom"
            autocomplete="address-level1"
            :error="errors.state"
          />
        </template>

        <template v-if="countryId && (stateId || state)">
          <AppSheetSelect
            v-if="cityOptions.length"
            v-model="cityId"
            label="City (optional)"
            title="Select your city"
            placeholder="Select your city"
            :options="cityOptions"
          />
          <AppInput
            v-else
            v-model="city"
            label="City (optional)"
            placeholder="Uyo"
            autocomplete="address-level2"
            :error="errors.city"
          />
        </template>

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


      </div>
    </ion-content>

    <ion-footer class="cc-register__footer">
      <div class="cc-screen__footer">
        <AppButton
          :loading="submitting"
          :aria-label="submitting ? 'Creating account' : 'Create account'"
          @click="onSubmit"
        >
          {{ submitting ? 'Creating account…' : 'Create account' }}
        </AppButton>
        <p v-if="submitting" class="cc-register__submitting" role="status" aria-live="polite">
          Creating your account…
        </p>
        <div class="cc-text-body" style="text-align: center; font-size: 12.5px">
          Already have an account?
          <a href="#" @click.prevent="router.push({ name: 'login' })">Log in</a>
        </div>
      </div>
    </ion-footer>

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
import { IonContent, IonFooter, IonHeader, IonPage } from '@ionic/vue';
import { useForm } from 'vee-validate';
import { toTypedSchema } from '@vee-validate/zod';
import { useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import AppInput from '@/components/ui/AppInput.vue';
import AppSheetSelect from '@/components/ui/AppSheetSelect.vue';
import AppSheet from '@/components/ui/AppSheet.vue';
import { authApi, type OtpRequestResult } from '@/api/auth.api';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import { ApiError } from '@/types/api';
import {
  passwordStrength,
  referredBySourceOptions,
  registerSchema,
} from '../schemas/register.schema';
import type { Address, ReferredBySource } from '@/types/user';
import { useCities, useCountries, useStates } from '@/composables/useLocations';
import {
  formatCoordinates,
  readDeviceLocation,
  type DeviceCoordinates,
} from '@/services/deviceLocation';

const router = useRouter();
const auth = useAuthStore();

const { defineField, errors, handleSubmit } = useForm({
  validationSchema: toTypedSchema(registerSchema),
  initialValues: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    country: '',
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
const locating = ref(false);
const coordinates = ref<DeviceCoordinates | null>(null);
const locationError = ref<'denied' | 'unavailable' | null>(null);

const locationNote = computed(() => {
  if (coordinates.value) {
    // Shown so the fix is visible rather than taken silently. It does not fill
    // the fields below: turning a point into a city needs a geocoder, and there
    // is none — so the person still says where they are.
    return `Shared: ${formatCoordinates(coordinates.value)}. Still choose your area below.`;
  }
  if (locationError.value === 'denied') {
    return 'Location is off for CruxCare. You can still choose your area below.';
  }
  if (locationError.value === 'unavailable') {
    return 'We could not read your location. Choose your area below instead.';
  }
  return 'Optional. Helps us show therapists near you.';
});

async function useMyLocation() {
  locating.value = true;
  locationError.value = null;
  try {
    const outcome = await readDeviceLocation();
    if (outcome.ok) coordinates.value = outcome.coordinates;
    else locationError.value = outcome.reason;
  } finally {
    locating.value = false;
  }
}

const [city] = defineField('city');
const [state] = defineField('state');
const [country] = defineField('country');

/**
 * The three selects, by id. Names are what the address stores — the therapist
 * directory composes its location string from them — so ids are resolved back
 * to names on submit rather than sent.
 */
const countryId = ref('');
const stateId = ref('');
const cityId = ref('');

/** Switched-on countries, read without a session — registration has none. */
const { data: countries } = useCountries();
const countryOptions = computed(() =>
  (countries.value ?? []).map((c) => ({ value: c.id, label: c.name })),
);

const selectedCountryId = computed(() => countryId.value || null);
const { data: states } = useStates(selectedCountryId);
const stateOptions = computed(() =>
  (states.value ?? []).map((s) => ({ value: s.id, label: s.name })),
);

const selectedStateId = computed(() => stateId.value || null);
const { data: cities } = useCities(selectedStateId);
const cityOptions = computed(() =>
  (cities.value ?? []).map((c) => ({ value: c.id, label: c.name })),
);

// Choosing a different country invalidates what was chosen below it.
watch([countryId, country], () => {
  stateId.value = '';
  cityId.value = '';
  state.value = '';
  city.value = '';
});
watch(stateId, () => {
  cityId.value = '';
  city.value = '';
});

function labelFor(options: { value: string; label: string }[], value: string): string | undefined {
  return options.find((o) => o.value === value)?.label;
}

/** Only the parts that were given — an address of empty strings would claim a
 *  location nobody stated. Takes the selected name, or the typed one where the
 *  platform has no list to choose from. */
function addressFrom(values: { city?: string; state?: string; country?: string }): Address | null {
  const address: Address = {};

  const countryName = labelFor(countryOptions.value, countryId.value) ?? values.country?.trim();
  if (countryName) address.country = countryName;

  const stateName = labelFor(stateOptions.value, stateId.value) ?? values.state?.trim();
  if (stateName) address.state = stateName;

  const cityName = labelFor(cityOptions.value, cityId.value) ?? values.city?.trim();
  if (cityName) address.city = cityName;

  return Object.keys(address).length ? address : null;
}

const [referredBySource] = defineField('referredBySource');
const [password] = defineField('password');
const [confirmPassword] = defineField('confirmPassword');
const [consent] = defineField('consent');

const showPassword = ref(false);
const showConfirm = ref(false);
const submitting = ref(false);
const toast = useToast();

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
  const phone = `+234${values.phone}`;
  const address = addressFrom(values);

  try {
    await auth.register({
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone,
      password: values.password,
      referredBySource: values.referredBySource as ReferredBySource,
      // Sent only when something was given, so an untouched form does not
      // register an address of empty strings.
      ...(address ? { address } : {}),
      ...(coordinates.value
        ? { latitude: coordinates.value.latitude, longitude: coordinates.value.longitude }
        : {}),
    });
  } catch (e) {
    const message = e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
    await toast.show(message, 'danger', {
      title: 'Could not create account',
      dismissLabel: 'Try again',
    });
    submitting.value = false;
    return;
  }

  let delivery: OtpRequestResult | undefined;
  try {
    delivery = await authApi.requestOtp('email', 'signup');
  } catch (e) {
    const message = e instanceof ApiError ? e.message : 'We could not send your verification email.';
    await toast.show(`${message} You can request another code on the next screen.`, 'warning', {
      title: 'Account created',
      dismissLabel: 'Continue',
    });
  } finally {
    submitting.value = false;
  }

  router.replace({
    name: 'register-otp',
    query: {
      purpose: 'signup',
      contact: delivery?.destination ?? values.email,
      channel: 'email',
      resendAvailableAt: delivery?.resendAvailableAt,
      // A failed send leaves the flag off so the OTP screen retries on arrival.
      sent: delivery ? 'true' : undefined,
      redirect: 'health-profile-gate',
    },
  });
});
</script>

<style scoped>
.cc-register__locate {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cc-register__locate-note {
  margin: 0;
}
.cc-register__pair {
  display: flex;
  gap: 10px;
}
.cc-register__pair > * {
  flex: 1;
  min-width: 0;
}
.cc-screen {
  --background: var(--cc-surface-app);
}
.cc-register__header,
.cc-register__footer {
  box-shadow: none;
}
.cc-register__header {
  background: var(--cc-surface-app);
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
  background: var(--cc-surface-app);
  padding: 11px 16px calc(16px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-register__submitting {
  margin: -2px 0 0;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  color: var(--cc-ink-500);
  text-align: center;
}

</style>
