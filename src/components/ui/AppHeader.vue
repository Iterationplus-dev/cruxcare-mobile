<template>
  <ion-header class="cc-header" :class="{ 'cc-header--botanical': botanical }">
    <ion-toolbar class="cc-header__toolbar">
      <ion-buttons v-if="showBack" slot="start">
        <button type="button" class="cc-header__back" :aria-label="backLabel" @click="goBack">
          <AppIcon name="arrow_back_ios_new" :size="22" color="var(--cc-ink-900)" />
        </button>
      </ion-buttons>
      <ion-title class="cc-header__title cc-text-h1">{{ title }}</ion-title>
      <ion-buttons v-if="$slots.actions" slot="end"><slot name="actions" /></ion-buttons>
    </ion-toolbar>
  </ion-header>
</template>

<script setup lang="ts">
import { IonButtons, IonHeader, IonTitle, IonToolbar } from '@ionic/vue';
import { useRouter } from 'vue-router';
import AppIcon from './AppIcon.vue';

/**
 * `botanical` reproduces the README "Background treatment": authenticated
 * screens carry screen-bg.png behind the header with a white scrim so the
 * art shows only behind the header and in empty space. Pre-login, dark
 * screens (video/live room/lock) and PR1/PR2 opt out (botanical=false).
 */
const props = withDefaults(
  defineProps<{
    title: string;
    showBack?: boolean;
    botanical?: boolean;
    backLabel?: string;
    /** Where to land when this screen was opened directly, with nothing to go back to. */
    backHref?: string;
  }>(),
  { showBack: false, botanical: true, backLabel: 'Back', backHref: '/tabs/home' },
);

const router = useRouter();

/**
 * Replaces ion-back-button, which silently did nothing on screens reached
 * via router.replace() (no entry in the outlet's stack) — leaving people
 * stranded on the health profile and password-reset screens.
 */
function goBack() {
  if (window.history.state?.back) router.back();
  else router.replace(props.backHref);
}
</script>

<style scoped>
.cc-header {
  box-shadow: none;
}
.cc-header--botanical {
  background-image: url('@/assets/images/screen-bg.png');
  background-size: cover;
  background-position: top center;
}
.cc-header__toolbar {
  --background: transparent;
  --border-width: 0;
}
.cc-header--botanical .cc-header__toolbar {
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.8),
    rgba(255, 255, 255, 0.62) 55%,
    rgba(247, 250, 249, 0.92)
  );
}
.cc-header__back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--cc-touch-min);
  height: var(--cc-touch-min);
  background: none;
  border: none;
  cursor: pointer;
}
.cc-header__title {
  color: var(--cc-ink-900);
}
</style>
