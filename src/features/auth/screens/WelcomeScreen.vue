<template>
  <ion-page>
    <ion-content :fullscreen="true" :scroll-y="false" class="cc-welcome">
      <div ref="track" class="cc-welcome__track" @scroll="onScroll">
        <section
          v-for="(slide, i) in slides"
          :key="slide.title"
          class="cc-welcome__slide"
          :style="{ backgroundImage: `url(${slide.img})` }"
        >
          <div class="cc-welcome__scrim" />
          <div class="cc-welcome__body">
            <div class="cc-welcome__dots">
              <span
                v-for="(_, d) in slides"
                :key="d"
                class="cc-welcome__dot"
                :class="{ 'cc-welcome__dot--active': d === i }"
              />
            </div>
            <h1 class="cc-welcome__title">{{ slide.title }}</h1>
            <p class="cc-welcome__subtitle">{{ slide.body }}</p>
            <div class="cc-welcome__actions">
              <AppButton @click="slide.onPrimary">{{ slide.primaryLabel }}</AppButton>
              <AppButton v-if="slide.secondaryLabel" variant="secondary" @click="slide.onSecondary">
                {{ slide.secondaryLabel }}
              </AppButton>
              <button type="button" class="cc-welcome__text-link" @click="slide.onTertiary">
                {{ slide.tertiaryLabel }}
              </button>
            </div>
          </div>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import welcomeHands from '@/assets/images/welcome-hands.png';
import welcomeLeaf from '@/assets/images/welcome-leaf.png';
import welcomeLiving from '@/assets/images/welcome-living.png';

/**
 * CA1 "Welcome / Get started" — the same three-slide carousel as A1a-A1c.
 * Every slide keeps both auth doors and the guest path reachable.
 */
const router = useRouter();
const track = ref<HTMLElement | null>(null);
const activeIndex = ref(0);

function goTo(i: number) {
  track.value?.children[i]?.scrollIntoView({ behavior: 'smooth', inline: 'start' });
}

function onScroll() {
  if (!track.value) return;
  activeIndex.value = Math.round(track.value.scrollLeft / track.value.clientWidth);
}

function goGuest() {
  // Wired to the standalone guest catalog route added in the Marketplace milestone.
  router.push({ name: 'catalog-guest' });
}

const slides = [
  {
    img: welcomeHands,
    title: 'Natural care, in one place',
    body: 'Natural products, therapist care and a supportive community — held together in one place.',
    primaryLabel: 'Get started',
    onPrimary: () => goTo(1),
    secondaryLabel: null as string | null,
    onSecondary: () => {},
    tertiaryLabel: 'Skip',
    onTertiary: () => goTo(2),
  },
  {
    img: welcomeLeaf,
    title: 'Remedies you can trust',
    body: 'Blends and herbs sourced by CruxCare, and recommended by the therapist who knows your history.',
    primaryLabel: 'Next',
    onPrimary: () => goTo(2),
    secondaryLabel: null as string | null,
    onSecondary: () => {},
    tertiaryLabel: 'Skip',
    onTertiary: () => goTo(2),
  },
  {
    img: welcomeLiving,
    title: 'Habits, care and community',
    body: 'Book a therapist, join live sessions, and save alongside members working toward the same thing.',
    primaryLabel: 'Create an account',
    onPrimary: () => router.push({ name: 'register' }),
    secondaryLabel: 'I already have one',
    onSecondary: () => router.push({ name: 'login' }),
    tertiaryLabel: 'Browse the shop as a guest',
    onTertiary: goGuest,
  },
];
</script>

<style scoped>
.cc-welcome {
  --background: #0a5a4e;
}
.cc-welcome__track {
  display: flex;
  height: 100%;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}
.cc-welcome__slide {
  flex: 0 0 100%;
  scroll-snap-align: start;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  position: relative;
  background-color: #0a5a4e;
  background-size: cover;
  background-position: center 30%;
  color: #ffffff;
}
.cc-welcome__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(10, 90, 78, 0) 40%, rgba(10, 90, 78, 0.85) 72%, #0a5a4e 100%);
}
.cc-welcome__body {
  position: relative;
  padding: 0 24px calc(28px + env(safe-area-inset-bottom));
}
.cc-welcome__dots {
  display: flex;
  gap: 6px;
  margin-bottom: 20px;
  padding-top: 40vh;
}
.cc-welcome__dot {
  width: 8px;
  height: 4px;
  border-radius: var(--cc-radius-pill);
  background: rgba(255, 255, 255, 0.35);
}
.cc-welcome__dot--active {
  width: 22px;
  background: #ffffff;
}
.cc-welcome__title {
  margin: 0 0 10px;
  font-family: var(--cc-font-interface);
  font-weight: 700;
  font-size: 22px;
  line-height: 28px;
  letter-spacing: -0.02em;
}
.cc-welcome__subtitle {
  margin: 0 0 24px;
  font-family: var(--cc-font-interface);
  font-size: 16px;
  line-height: 22px;
  color: #cde7e1;
}
.cc-welcome__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-welcome__actions :deep(.cc-btn--primary) {
  background: #ffffff;
  color: #0a5a4e;
}
.cc-welcome__actions :deep(.cc-btn--secondary) {
  background: transparent;
  border-color: rgba(255, 255, 255, 0.45);
  color: #ffffff;
}
.cc-welcome__text-link {
  background: none;
  border: none;
  color: #9bd2c8;
  font-family: var(--cc-font-interface);
  font-weight: 500;
  font-size: 13px;
  padding: 10px 0;
  cursor: pointer;
  min-height: var(--cc-touch-min);
}
</style>
