import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { SplashScreen } from '@capacitor/splash-screen';
import App from './App.vue';
import router from './router';
import { initStatusBar } from './services/statusBar';

import { IonicVue } from '@ionic/vue';

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* @import '@ionic/vue/css/palettes/dark.always.css'; */
/* @import '@ionic/vue/css/palettes/dark.class.css'; */
import '@ionic/vue/css/palettes/dark.system.css';

/* CruxCare design tokens, fonts and typography (source of truth: design
   handoff README.md "Design tokens"). Order matters: tokens before variables
   (which reference them), fonts before typography (which uses the families). */
import './theme/tokens.css';
import './theme/fonts.css';
import './theme/variables.css';
import './theme/typography.css';

async function enableMocksIfNeeded() {
  // Gated on the env flag alone (not import.meta.env.DEV) so native builds —
  // which run as a production build — still get the mock backend until a
  // real API exists. Flip VITE_USE_API_MOCKS to false once one does.
  if (import.meta.env.VITE_USE_API_MOCKS === 'true') {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }
}

async function bootstrap() {
  await enableMocksIfNeeded();
  initStatusBar();

  const app = createApp(App).use(IonicVue).use(createPinia()).use(VueQueryPlugin).use(router);

  await router.isReady();
  app.mount('#app');
  void SplashScreen.hide();
}

bootstrap();
