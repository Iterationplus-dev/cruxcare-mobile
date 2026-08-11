import type { RouteRecordRaw } from 'vue-router';

/**
 * Two navigation shells (TabsLayout for the five client tabs, TherapistLayout
 * for its own five-tab bar per TD1 — see README IA note on role switch, not
 * shared tabs) plus flat top-level routes for everything pushed on top of
 * either shell. Meta flags drive router/index.ts's guard:
 *  - requiresAuth: needs a session
 *  - requiresGuest: only for signed-out visitors
 *  - requiresHealthProfile: gated behind A4 completion (client care features)
 */
const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/auth/welcome' },

  // ---- Pre-auth ----
  {
    path: '/auth/welcome',
    name: 'welcome',
    component: () => import('@/features/auth/screens/WelcomeScreen.vue'),
    meta: { requiresGuest: true, darkStatusBar: true },
  },
  {
    path: '/auth/register',
    name: 'register',
    component: () => import('@/features/auth/screens/RegisterScreen.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/auth/otp',
    name: 'register-otp',
    component: () => import('@/features/auth/screens/VerifyOtpScreen.vue'),
  },
  {
    path: '/auth/login',
    name: 'login',
    component: () => import('@/features/auth/screens/LoginScreen.vue'),
    meta: { requiresGuest: true },
  },
  {
    path: '/auth/forgot-password',
    name: 'forgot-password',
    component: () => import('@/features/auth/screens/ForgotPasswordScreen.vue'),
  },
  {
    path: '/auth/reset-password',
    name: 'reset-password',
    component: () => import('@/features/auth/screens/ResetPasswordScreen.vue'),
  },
  {
    path: '/auth/reset-success',
    name: 'reset-success',
    component: () => import('@/features/auth/screens/PasswordResetSuccessScreen.vue'),
  },
  {
    path: '/auth/assisted-recovery',
    name: 'assisted-recovery',
    component: () => import('@/features/auth/screens/AssistedRecoveryScreen.vue'),
  },

  // ---- Post-auth onboarding ----
  {
    path: '/onboarding/biometric',
    name: 'biometric-opt-in',
    component: () => import('@/features/auth/screens/BiometricOptInScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/onboarding/health-profile-gate',
    name: 'health-profile-gate',
    component: () => import('@/features/auth/screens/HealthProfileGateScreen.vue'),
    meta: { requiresAuth: true },
  },

  // ---- Therapist activation ----
  // TA1 is the public landing reached from Login's therapist door. Starting
  // verification remains protected on the subsequent route because it adds a
  // role to the existing account.
  {
    path: '/become-therapist',
    name: 'become-therapist',
    component: () => import('@/features/auth/screens/BecomeTherapistScreen.vue'),
    meta: { darkStatusBar: true },
  },
  {
    path: '/become-therapist/link-crux-id',
    name: 'link-crux-id',
    component: () => import('@/features/auth/screens/LinkCruxIdScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/become-therapist/plan',
    name: 'therapist-plan',
    component: () => import('@/features/auth/screens/TherapistPlanScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/become-therapist/complete',
    name: 'therapist-onboarding-complete',
    component: () => import('@/features/auth/screens/TherapistOnboardingCompleteScreen.vue'),
    meta: { requiresAuth: true, darkStatusBar: true },
  },

  // ---- Client tabs shell ----
  {
    path: '/tabs',
    component: () => import('@/layouts/TabsLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/tabs/home' },
      { path: 'home', name: 'tabs-home', component: () => import('@/features/home/screens/HomeScreen.vue') },
      { path: 'shop', name: 'catalog', component: () => import('@/features/marketplace/screens/CatalogScreen.vue') },
      { path: 'care', name: 'care-hub', component: () => import('@/features/care/screens/CareHubScreen.vue') },
      { path: 'wallet', name: 'wallet-home', component: () => import('@/features/wallet/screens/WalletHomeScreen.vue') },
      { path: 'profile', name: 'profile', component: () => import('@/features/profile/screens/ProfileScreen.vue') },
      { path: 'member-home', name: 'tabs-member-home', component: () => import('@/features/member/screens/MemberHomeScreen.vue'), meta: { requiresRole: 'member' } },
      { path: 'grow', name: 'grow-hub', component: () => import('@/features/member/screens/GrowHubScreen.vue'), meta: { requiresRole: 'member' } },
      { path: 'more', name: 'member-more', component: () => import('@/features/member/screens/MemberMoreScreen.vue'), meta: { requiresRole: 'member' } },
    ],
  },

  // Guest marketplace browsing (PRD Guest capability) — no auth required.
  {
    path: '/shop/guest',
    name: 'catalog-guest',
    component: () => import('@/features/marketplace/screens/CatalogScreen.vue'),
    props: { guestMode: true },
  },

  // ---- Marketplace pushes ----
  {
    path: '/shop/product/:id',
    name: 'product-detail',
    component: () => import('@/features/marketplace/screens/ProductDetailScreen.vue'),
    // Guests may browse product detail (PRD Guest capability); the
    // add-to-cart action is what routes them to login, not the page itself.
  },
  {
    path: '/shop/cart',
    name: 'cart',
    component: () => import('@/features/marketplace/screens/CartScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/shop/checkout',
    name: 'checkout',
    component: () => import('@/features/marketplace/screens/CheckoutScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/shop/orders',
    name: 'orders-list',
    component: () => import('@/features/marketplace/screens/OrdersListScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/shop/orders/:id/confirmed',
    name: 'order-confirmed',
    component: () => import('@/features/marketplace/screens/OrderConfirmedScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/shop/orders/:id',
    name: 'order-detail',
    component: () => import('@/features/marketplace/screens/OrderDetailScreen.vue'),
    meta: { requiresAuth: true },
  },

  // ---- Care pushes ----
  {
    path: '/care/book',
    name: 'book-appointment',
    component: () => import('@/features/care/screens/BookAppointmentScreen.vue'),
    meta: { requiresAuth: true, requiresHealthProfile: true },
  },
  {
    path: '/care/health-profile',
    name: 'health-profile',
    component: () => import('@/features/care/screens/HealthProfileScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/care/therapists/:id',
    name: 'therapist-detail',
    component: () => import('@/features/care/screens/TherapistDetailScreen.vue'),
    meta: { requiresAuth: true },
  },

  // ---- Wallet pushes ----
  {
    path: '/wallet/ledger',
    name: 'ledger',
    component: () => import('@/features/wallet/screens/LedgerScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/wallet/withdraw',
    name: 'wallet-withdraw',
    component: () => import('@/features/wallet/screens/MoneyActionScreen.vue'),
    props: { action: 'withdrawal' },
    meta: { requiresAuth: true },
  },
  {
    path: '/wallet/transfer',
    name: 'wallet-transfer',
    component: () => import('@/features/wallet/screens/MoneyActionScreen.vue'),
    props: { action: 'transfer' },
    meta: { requiresAuth: true, requiresRole: 'member' },
  },

  // ---- Member programmes: Finance and Grow ----
  {
    path: '/member/commitment',
    name: 'member-commitment',
    component: () => import('@/features/member/screens/MemberProgramScreen.vue'),
    props: { program: 'commitment' },
    meta: { requiresAuth: true, requiresRole: 'member' },
  },
  {
    path: '/member/cooperative',
    name: 'member-cooperative',
    component: () => import('@/features/member/screens/MemberProgramScreen.vue'),
    props: { program: 'cooperative' },
    meta: { requiresAuth: true, requiresRole: 'member' },
  },
  {
    path: '/member/rank',
    name: 'member-rank',
    component: () => import('@/features/member/screens/MemberProgramScreen.vue'),
    props: { program: 'rank' },
    meta: { requiresAuth: true, requiresRole: 'member' },
  },
  {
    path: '/member/network',
    name: 'member-network',
    component: () => import('@/features/member/screens/MemberProgramScreen.vue'),
    props: { program: 'network' },
    meta: { requiresAuth: true, requiresRole: 'member' },
  },
  {
    path: '/member/earnings',
    name: 'member-earnings',
    component: () => import('@/features/member/screens/MemberProgramScreen.vue'),
    props: { program: 'earnings' },
    meta: { requiresAuth: true, requiresRole: 'member' },
  },
  {
    path: '/point-facility',
    name: 'point-facility',
    component: () => import('@/features/member/screens/PointFacilityScreen.vue'),
    props: { view: 'home' },
    meta: { requiresAuth: true },
  },
  {
    path: '/point-facility/session',
    name: 'point-facility-session',
    component: () => import('@/features/member/screens/PointFacilityScreen.vue'),
    props: { view: 'session' },
    meta: { requiresAuth: true },
  },
  {
    path: '/point-facility/live',
    name: 'point-facility-live',
    component: () => import('@/features/member/screens/PointFacilityScreen.vue'),
    props: { view: 'live' },
    meta: { requiresAuth: true, darkStatusBar: true },
  },
  {
    path: '/admin/approvals',
    name: 'admin-approvals',
    component: () => import('@/features/admin/screens/AdminApprovalsScreen.vue'),
    meta: { requiresAuth: true, requiresRole: 'admin' },
  },

  // ---- Shared: chat, video, notifications, help ----
  {
    path: '/messages',
    name: 'chat-inbox',
    component: () => import('@/features/shared/screens/ChatInboxScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/messages/:id',
    name: 'chat-thread',
    component: () => import('@/features/shared/screens/ChatThreadScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/video/:id',
    name: 'video-visit',
    component: () => import('@/features/shared/screens/VideoVisitScreen.vue'),
    meta: { requiresAuth: true, darkStatusBar: true },
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: () => import('@/features/shared/screens/NotificationsInboxScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/support',
    name: 'help-support',
    component: () => import('@/features/shared/screens/HelpSupportScreen.vue'),
    meta: { requiresAuth: true },
  },

  // ---- Profile / account management pushes ----
  {
    path: '/profile/personal-info',
    name: 'personal-info',
    component: () => import('@/features/profile/screens/PersonalInfoScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile/security',
    name: 'security-privacy',
    component: () => import('@/features/profile/screens/SecurityPrivacyScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile/notifications',
    name: 'notification-settings',
    component: () => import('@/features/profile/screens/NotificationSettingsScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile/payment-methods',
    name: 'payment-methods',
    component: () => import('@/features/profile/screens/PaymentMethodsScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile/settings',
    name: 'client-settings',
    component: () => import('@/features/profile/screens/ClientSettingsScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile/delete',
    name: 'delete-account',
    component: () => import('@/features/profile/screens/DeleteAccountScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile/delete/confirm',
    name: 'delete-confirm',
    component: () => import('@/features/profile/screens/DeleteConfirmScreen.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/profile/deleted',
    name: 'account-deleted',
    component: () => import('@/features/profile/screens/AccountDeletedScreen.vue'),
  },

  // ---- Therapist tabs shell (own 5-tab bar, reached via role switch) ----
  {
    path: '/therapist',
    component: () => import('@/layouts/TherapistLayout.vue'),
    meta: { requiresAuth: true, requiresRole: 'therapist' },
    children: [
      { path: '', redirect: '/therapist/today' },
      { path: 'today', name: 'therapist-today', component: () => import('@/features/therapist/screens/TherapistTodayScreen.vue') },
      { path: 'calendar', name: 'therapist-calendar', component: () => import('@/features/therapist/screens/TherapistCalendarScreen.vue') },
      { path: 'clients', name: 'therapist-clients', component: () => import('@/features/therapist/screens/TherapistClientsScreen.vue') },
      { path: 'earnings', name: 'therapist-earnings', component: () => import('@/features/therapist/screens/TherapistEarningsScreen.vue') },
      { path: 'profile', name: 'therapist-profile', component: () => import('@/features/therapist/screens/TherapistProfileScreen.vue') },
    ],
  },
  {
    path: '/therapist/appointments',
    name: 'appointment-management',
    component: () => import('@/features/therapist/screens/AppointmentManagementScreen.vue'),
    meta: { requiresAuth: true, requiresRole: 'therapist' },
  },
  {
    path: '/therapist/clients/:id',
    name: 'case-file',
    component: () => import('@/features/therapist/screens/CaseFileScreen.vue'),
    meta: { requiresAuth: true, requiresRole: 'therapist' },
  },
  {
    path: '/therapist/availability',
    name: 'therapist-availability',
    component: () => import('@/features/therapist/screens/TherapistAvailabilityScreen.vue'),
    meta: { requiresAuth: true, requiresRole: 'therapist' },
  },
  {
    path: '/therapist/payout-account',
    name: 'therapist-payout-account',
    component: () => import('@/features/therapist/screens/TherapistPayoutAccountScreen.vue'),
    meta: { requiresAuth: true, requiresRole: 'therapist' },
  },
];

export default routes;
