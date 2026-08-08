<template>
  <ion-header class="cc-header" :class="{ 'cc-header--botanical': botanical }">
    <ion-toolbar class="cc-header__toolbar">
      <ion-buttons v-if="showBack" slot="start">
        <ion-back-button
          default-href="/"
          text=""
          class="cc-header__back"
          :aria-label="backLabel"
        />
      </ion-buttons>
      <ion-title class="cc-header__title cc-text-h1">{{ title }}</ion-title>
      <ion-buttons v-if="$slots.actions" slot="end"><slot name="actions" /></ion-buttons>
    </ion-toolbar>
  </ion-header>
</template>

<script setup lang="ts">
import { IonBackButton, IonButtons, IonHeader, IonTitle, IonToolbar } from '@ionic/vue';

/**
 * `botanical` reproduces the README "Background treatment": authenticated
 * screens carry screen-bg.png behind the header with a white scrim so the
 * art shows only behind the header and in empty space. Pre-login, dark
 * screens (video/live room/lock) and PR1/PR2 opt out (botanical=false).
 */
withDefaults(
  defineProps<{ title: string; showBack?: boolean; botanical?: boolean; backLabel?: string }>(),
  { showBack: false, botanical: true, backLabel: 'Back' },
);
</script>

<style scoped>
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
.cc-header__title {
  color: var(--cc-ink-900);
}
</style>
