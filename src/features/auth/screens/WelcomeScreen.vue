<template>
  <ion-page>
    <ion-content :fullscreen="true" :scroll-y="false" class="cc-welcome">
      <div ref="track" class="cc-welcome__track" @scroll="onScroll">
        <section v-for="(slide, i) in slides" :key="slide.subtitle + i" class="cc-welcome__slide">
          <div class="cc-welcome__wordmark">
            <div class="cc-welcome__brand">
              <span class="cc-welcome__brand-crux">CRUX</span><span class="cc-welcome__brand-care">CARE</span>
            </div>
            <div class="cc-welcome__tagline">Care naturally. Live fully.</div>
            <div class="cc-welcome__divider">
              <span class="cc-welcome__divider-line" />
              <AppIcon name="eco" :size="14" color="var(--cc-color-leaf)" />
              <span class="cc-welcome__divider-line" />
            </div>
          </div>

          <h1 v-if="slide.heading" class="cc-welcome__title">{{ slide.heading }}</h1>
          <p class="cc-welcome__subtitle">{{ slide.subtitle }}</p>

          <div
            class="cc-welcome__photo"
            :style="{ backgroundImage: `url(${slide.img})`, backgroundPosition: slide.focus ?? 'center' }"
          />

          <div class="cc-welcome__card">
            <div v-for="f in featuresFor(slide)" :key="f.title" class="cc-welcome__row">
              <span class="cc-welcome__row-icon"><AppIcon :name="f.icon" :size="20" color="var(--cc-color-primary-dark)" /></span>
              <span class="cc-welcome__row-body">
                <span class="cc-welcome__row-title">{{ f.title }}</span>
                <span class="cc-welcome__row-desc">{{ f.desc }}</span>
              </span>
              <AppIcon name="chevron_right" :size="20" color="var(--cc-ink-300)" />
            </div>

            <AppButton class="cc-welcome__cta" @click="slide.onPrimary">{{ slide.primaryLabel }}</AppButton>
            <button type="button" class="cc-welcome__signin" @click="router.push({ name: 'login' })">
              Already have an account? <span>Sign In</span>
            </button>
            <button v-if="slide.showGuestLink" type="button" class="cc-welcome__guest" @click="goGuest">
              Browse the shop as a guest
            </button>

            <div class="cc-welcome__dots">
              <span
                v-for="(_, d) in slides"
                :key="d"
                class="cc-welcome__dot"
                :class="{ 'cc-welcome__dot--active': d === i }"
              />
            </div>
          </div>
        </section>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { IonContent, IonPage } from '@ionic/vue';
import { useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import welcomeHands from '@/assets/images/welcome-hands.webp';
import welcomeLeaf from '@/assets/images/welcome-leaf.webp';
import welcomeMassage from '@/assets/images/welcome-massage.webp';

/**
 * CA1 "Welcome / Get started" — the same three-slide carousel as A1a-A1c.
 * Every slide keeps both auth doors and the guest path reachable.
 * (White status bar icons for this screen are set via the route's
 * `darkStatusBar` meta — see router/index.ts.)
 */
const router = useRouter();
const track = ref<HTMLElement | null>(null);
const activeIndex = ref(0);

function goTo(i: number) {
  track.value?.children[i]?.scrollIntoView({ behavior: 'smooth', inline: 'start' });
}

onMounted(() => {
  // Guard against the browser auto-scrolling the horizontal track to bring
  // the tallest (overflowing) slide into view on first paint.
  const reset = () => {
    if (track.value) track.value.scrollLeft = 0;
  };
  requestAnimationFrame(reset);
  setTimeout(reset, 60);
  setTimeout(reset, 300);
});

function onScroll() {
  if (!track.value) return;
  activeIndex.value = Math.round(track.value.scrollLeft / track.value.clientWidth);
}

function goGuest() {
  // Wired to the standalone guest catalog route added in the Marketplace milestone.
  router.push({ name: 'catalog-guest' });
}

const features = [
  { icon: 'eco', title: 'Natural Products', desc: 'Discover high-quality natural products for your everyday wellness.' },
  { icon: 'self_improvement', title: 'Therapist Care', desc: 'Book trusted therapists and take charge of your well-being.' },
  { icon: 'groups', title: 'Supportive Community', desc: 'Connect, share, and grow with people on the same journey.' },
  { icon: 'favorite', title: 'Healthy Living', desc: 'Build better daily habits and live a balanced, fulfilling life.' },
];

const slides = [
  {
    img: welcomeHands,
    focus: undefined as string | undefined,
    heading: 'Welcome to CruxCare',
    subtitle: 'Your all-in-one platform for natural products, therapist care, and a supportive community.',
    featureTitles: ['Natural Products', 'Therapist Care', 'Supportive Community'],
    primaryLabel: 'Get Started',
    onPrimary: () => goTo(1),
    showGuestLink: false,
  },
  {
    img: welcomeLeaf,
    focus: undefined as string | undefined,
    heading: 'Wellness Rooted in Nature',
    subtitle: 'Discover pure, natural products for everyday wellness.',
    featureTitles: ['Natural Products', 'Therapist Care', 'Supportive Community'],
    primaryLabel: 'Next',
    onPrimary: () => goTo(2),
    showGuestLink: false,
  },
  {
    img: welcomeMassage,
    // Subject (the two figures) sits right-of-center in the source photo.
    focus: '75% 40%',
    heading: 'Live Well, Every Day!',
    subtitle: 'Build healthier habits for everyday living.',
    featureTitles: ['Natural Products', 'Supportive Community', 'Healthy Living'],
    primaryLabel: 'Create an account',
    onPrimary: () => router.push({ name: 'register' }),
    showGuestLink: true,
  },
];

function featuresFor(slide: (typeof slides)[number]) {
  return features.filter((f) => slide.featureTitles.includes(f.title));
}
</script>

<style scoped>
.cc-welcome {
  --background: #f7faf9;
}
.cc-welcome__track {
  display: flex;
  height: 100%;
  overflow-x: auto;
  overflow-anchor: none;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}
.cc-welcome__slide {
  flex: 0 0 100%;
  min-width: 0;
  scroll-snap-align: start;
  overflow-anchor: none;
  height: 100%;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f7faf9;
  padding: calc(env(safe-area-inset-top) + 14px) 20px calc(env(safe-area-inset-bottom) + 16px);
  box-sizing: border-box;
}
.cc-welcome__wordmark {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}
.cc-welcome__brand {
  font-family: var(--cc-font-interface);
  font-weight: 800;
  font-size: 21px;
  letter-spacing: -0.01em;
}
.cc-welcome__brand-crux {
  color: var(--cc-color-primary-dark);
}
.cc-welcome__brand-care {
  color: var(--cc-color-leaf);
}
.cc-welcome__tagline {
  font-family: var(--cc-font-interface);
  font-size: 11.5px;
  color: var(--cc-ink-600);
  margin-top: 2px;
}
.cc-welcome__divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0 12px;
  width: 100%;
  max-width: 160px;
}
.cc-welcome__divider-line {
  flex: 1;
  height: 1px;
  background: var(--cc-line);
}
.cc-welcome__title {
  margin: 0 0 6px;
  font-family: var(--cc-font-interface);
  font-weight: 800;
  font-size: 21px;
  line-height: 26px;
  letter-spacing: -0.01em;
  color: var(--cc-color-primary-dark);
  text-align: center;
}
.cc-welcome__subtitle {
  margin: 0 0 14px;
  font-family: var(--cc-font-interface);
  font-size: 13.5px;
  line-height: 19px;
  color: var(--cc-ink-600);
  text-align: center;
  max-width: 340px;
}
.cc-welcome__photo {
  width: 100%;
  min-height: 130px;
  height: min(24vh, 210px);
  border-radius: 20px;
  background-color: #eaf3f0;
  background-size: cover;
  background-repeat: no-repeat;
  flex-shrink: 0;
  margin-bottom: 16px;
}
.cc-welcome__card {
  width: 100%;
  background: var(--cc-surface-0);
  border-radius: var(--cc-radius-lg);
  box-shadow: var(--cc-elevation-2);
  padding: 16px 14px 4px;
  display: flex;
  flex-direction: column;
}
.cc-welcome__row {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 10px 0;
  border-bottom: 1px solid var(--cc-divider);
}
.cc-welcome__row:last-of-type {
  border-bottom: none;
}
.cc-welcome__row-icon {
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  background: var(--cc-color-mist);
  display: grid;
  place-items: center;
}
.cc-welcome__row-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.cc-welcome__row-title {
  font-family: var(--cc-font-interface);
  font-weight: 700;
  font-size: 14.5px;
  color: var(--cc-ink-900);
}
.cc-welcome__row-desc {
  font-family: var(--cc-font-interface);
  font-size: 12px;
  line-height: 17px;
  color: var(--cc-ink-400);
}
.cc-welcome__cta {
  margin-top: 12px;
}
.cc-welcome__cta :deep(.cc-btn--primary) {
  background: var(--cc-color-primary-dark);
}
.cc-welcome__signin {
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--cc-font-interface);
  font-size: 12.5px;
  color: var(--cc-ink-600);
  padding: 10px 0 2px;
  min-height: var(--cc-touch-min);
}
.cc-welcome__signin span {
  color: var(--cc-color-primary-dark);
  font-weight: 700;
}
.cc-welcome__guest {
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--cc-font-interface);
  font-weight: 500;
  font-size: 12.5px;
  color: var(--cc-color-primary-dark);
  text-decoration: underline;
  padding-bottom: 6px;
}
.cc-welcome__dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  padding-bottom: 6px;
}
.cc-welcome__dot {
  width: 8px;
  height: 4px;
  border-radius: var(--cc-radius-pill);
  background: var(--cc-color-mist);
}
.cc-welcome__dot--active {
  width: 22px;
  background: var(--cc-color-primary-dark);
}
</style>
