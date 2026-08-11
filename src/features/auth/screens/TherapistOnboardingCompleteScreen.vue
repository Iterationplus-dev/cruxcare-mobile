<template>
  <ion-page>
    <ion-content class="cc-screen cc-complete">
      <div class="cc-complete__content">
        <section class="cc-complete__hero" aria-labelledby="verification-title">
          <div class="cc-complete__verified-icon">
            <AppIcon name="verified" :size="36" color="var(--cc-color-primary)" />
          </div>
          <div class="cc-text-mono cc-complete__eyebrow">THERAPIST PROFILE ACTIVE</div>
          <h2 id="verification-title" class="cc-complete__title">You’re verified</h2>
          <p class="cc-complete__subtitle">Your therapist profile is live. Set your availability so clients can book a session.</p>
        </section>

        <section class="cc-complete__next" aria-labelledby="next-steps-title">
          <div class="cc-complete__section-heading">
            <h3 id="next-steps-title">Start here</h3>
            <span>3 simple steps</span>
          </div>

          <div class="cc-complete__steps">
            <button type="button" class="cc-complete__step cc-complete__step--recommended" @click="goAvailability">
              <div class="cc-complete__step-number">1</div>
              <AppIcon name="event_available" :size="22" color="var(--cc-color-primary)" />
              <div class="cc-complete__step-copy">
                <strong>Set your availability</strong>
                <span>Open a bookable week for clients.</span>
              </div>
              <span class="cc-complete__recommended">NEXT</span>
            </button>
            <button type="button" class="cc-complete__step" @click="goPayoutAccount">
              <div class="cc-complete__step-number">2</div>
              <AppIcon name="payments" :size="22" color="var(--cc-color-primary)" />
              <div class="cc-complete__step-copy">
                <strong>Confirm payout details</strong>
                <span>Make sure you can receive payments.</span>
              </div>
              <AppIcon name="chevron_right" :size="20" color="var(--cc-ink-400)" />
            </button>
            <button type="button" class="cc-complete__step" @click="goProfilePhoto">
              <div class="cc-complete__step-number">3</div>
              <AppIcon name="photo_camera" :size="22" color="var(--cc-color-primary)" />
              <div class="cc-complete__step-copy">
                <strong>Add a profile photo</strong>
                <span>Help new clients recognise and trust you.</span>
              </div>
              <AppIcon name="chevron_right" :size="20" color="var(--cc-ink-400)" />
            </button>
          </div>
        </section>

        <div class="cc-complete__note">
          <AppIcon name="info" :size="19" color="var(--cc-color-primary)" />
          <p>You can return to these tasks from your therapist profile at any time.</p>
        </div>
      </div>
    </ion-content>
    <ion-footer class="cc-complete__footer">
      <AppButton icon="event_available" @click="goAvailability">Set availability</AppButton>
      <button type="button" class="cc-complete__dashboard-link" @click="goDashboard">Go to therapist dashboard</button>
    </ion-footer>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonFooter, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import { AppButton, AppIcon } from '@/components/ui';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();

function activateTherapistRole() {
  auth.setActiveRole('therapist');
}

function goDashboard() {
  activateTherapistRole();
  router.replace({ name: 'therapist-today' });
}

function goAvailability() {
  activateTherapistRole();
  router.replace({ name: 'therapist-availability' });
}

function goPayoutAccount() {
  activateTherapistRole();
  router.replace({ name: 'therapist-payout-account' });
}

function goProfilePhoto() {
  router.replace({ name: 'personal-info', query: { focus: 'profile-photo' } });
}
</script>

<style scoped>
.cc-complete {
  --background: transparent;
}
.cc-complete__content {
  padding: calc(env(safe-area-inset-top) + 24px) 16px 28px;
}
.cc-complete__hero,
.cc-complete__next,
.cc-complete__note {
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(203, 216, 210, 0.94);
  box-shadow: 0 12px 30px rgba(26, 72, 62, 0.07);
}
.cc-complete__hero {
  padding: 24px 20px 22px;
  border-radius: 20px;
  text-align: center;
}
.cc-complete__verified-icon {
  width: 68px;
  height: 68px;
  display: grid;
  place-items: center;
  margin: 0 auto 14px;
  border-radius: 999px;
  background: var(--cc-color-mist);
  box-shadow: inset 0 0 0 1px rgba(14, 124, 107, 0.1);
}
.cc-complete__eyebrow {
  color: var(--cc-color-primary);
  font-size: 10.5px;
  letter-spacing: 0.08em;
}
.cc-complete__title {
  margin: 7px 0 8px;
  color: var(--cc-ink-900);
  font-family: var(--cc-font-interface);
  font-weight: 800;
  font-size: 26px;
  line-height: 32px;
  letter-spacing: -0.025em;
}
.cc-complete__subtitle {
  max-width: 300px;
  margin: 0 auto;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 14px;
  line-height: 21px;
}
.cc-complete__next {
  margin-top: 14px;
  padding: 17px 14px 8px;
  border-radius: 18px;
}
.cc-complete__section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 0 2px 12px;
}
.cc-complete__section-heading h3 {
  margin: 0;
  color: var(--cc-ink-900);
  font-family: var(--cc-font-interface);
  font-size: 16px;
  line-height: 22px;
}
.cc-complete__section-heading span {
  color: var(--cc-ink-400);
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
}
.cc-complete__steps {
  display: flex;
  flex-direction: column;
}
.cc-complete__step {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 70px;
  padding: 10px 2px;
  border: none;
  border-top: 1px solid var(--cc-divider);
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.cc-complete__step--recommended {
  margin: 0 -6px;
  padding-right: 8px;
  padding-left: 8px;
  border-top: none;
  border-radius: 12px;
  background: var(--cc-color-mist);
}
.cc-complete__step-number {
  width: 21px;
  height: 21px;
  display: grid;
  flex: none;
  place-items: center;
  border-radius: 999px;
  background: var(--cc-surface-1);
  color: var(--cc-ink-600);
  font-family: var(--cc-font-mono);
  font-size: 10px;
  font-weight: 600;
}
.cc-complete__step--recommended .cc-complete__step-number {
  background: var(--cc-color-primary);
  color: #fff;
}
.cc-complete__step-copy {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.cc-complete__step-copy strong {
  color: var(--cc-ink-900);
  font-family: var(--cc-font-interface);
  font-size: 13px;
  line-height: 18px;
}
.cc-complete__step-copy span {
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  line-height: 16px;
}
.cc-complete__recommended {
  color: var(--cc-color-primary-dark);
  font-family: var(--cc-font-mono);
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
}
.cc-complete__note {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  margin-top: 14px;
  padding: 12px 13px;
  border-radius: 14px;
}
.cc-complete__note p {
  margin: 0;
  color: var(--cc-ink-600);
  font-family: var(--cc-font-interface);
  font-size: 12px;
  line-height: 18px;
}
.cc-complete__footer {
  display: grid;
  gap: 9px;
  padding: 11px 16px calc(20px + env(safe-area-inset-bottom));
  border-top: 1px solid var(--cc-divider);
  background: rgba(255, 255, 255, 0.96);
}
.cc-complete__dashboard-link {
  width: fit-content;
  min-height: 28px;
  justify-self: center;
  padding: 0 8px;
  border: none;
  background: none;
  color: var(--cc-color-primary);
  font-family: var(--cc-font-interface);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
</style>
