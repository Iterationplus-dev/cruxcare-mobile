import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    requiresGuest?: boolean;
    requiresRole?: string;
    requiresHealthProfile?: boolean;
    /** White status bar icons for this screen's dark background (default: dark icons). */
    darkStatusBar?: boolean;
  }
}
