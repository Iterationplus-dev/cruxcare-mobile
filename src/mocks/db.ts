import type { Appointment, CareRequest, CaseFile, ChatMessage, ChatThread, HealthProfile, TherapistSummary, WorkingDay } from '@/types/care';
import type { Cart, Order, Product } from '@/types/marketplace';
import type { AppNotification } from '@/types/notifications';
import type { User } from '@/types/user';
import type { Transaction, Wallet } from '@/types/wallet';
import type { CurrencyIndex, LocalBlock, SupportedCurrency } from '@/types/money';
import type { SupportTicket } from '@/types/support';
import type { CarePlanOption, CareSubscription, HealthProfileAccess } from '@/types/care';
import pCayenmis from '@/assets/images/p-cayenmis.jpg';
import pGreenTea from '@/assets/images/p-green-tea.jpg';
import pGimPowder from '@/assets/images/p-gim-powder.jpg';
import pCapsicumPlaster from '@/assets/images/p-capsicum-plaster.jpg';
import pLumbarStretcher from '@/assets/images/p-lumbar-stretcher.jpg';
import pCaccigart from '@/assets/images/p-caccigart.jpg';
import { uiTestCredentials } from './testAccount';

/**
 * In-memory fixture "database" for MSW. Resets on every page reload —
 * that's fine, this stands in only until a real Laravel backend exists
 * (see .env.example VITE_USE_API_MOCKS).
 */

interface StoredUser extends User {
  username: string;
  password: string;
}

let idSeq = 1000;
export function nextId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}

export const demoCredentials = { identifier: 'demo@cruxcare.app', password: 'Passw0rd!1' };

export const users: StoredUser[] = [
  {
    id: 'user-1',
    username: 'amaka.obi',
    firstName: 'Amaka',
    lastName: 'Obi',
    email: demoCredentials.identifier,
    phone: '+2348012345678',
    avatarUrl: null,
    roles: ['client', 'member', 'therapist'],
    capabilities: [
      'orders.place',
      'appointments.book',
      'health-profile.write',
      'case-files.manage',
      'wallet.read',
    ],
    referredBySource: 'friends-family',
    gender: 'female',
    membership: { cruxId: 'CCI8804XO', tier: 'Bronze · Unit Leader', joinedAt: '2025-11-02T00:00:00Z' },
    therapistProfile: {
      plan: 'monthly',
      status: 'active',
      clientLimit: null,
      caseFileLimit: null,
      clientCount: 4,
      caseFileCount: 3,
    },
    biometricEnabled: false,
    createdAt: '2025-11-02T00:00:00Z',
    password: demoCredentials.password,
  },
  {
    id: 'ui-test-user',
    username: 'ui.tester',
    firstName: 'UI',
    lastName: 'Tester',
    email: uiTestCredentials.identifier,
    phone: '+2348090000000',
    avatarUrl: null,
    roles: ['client'],
    capabilities: ['orders.place', 'appointments.book', 'health-profile.write'],
    referredBySource: 'other',
    membership: null,
    therapistProfile: null,
    biometricEnabled: false,
    createdAt: '2026-08-11T00:00:00Z',
    password: uiTestCredentials.password,
  },
  {
    id: 'shared-email-user-1',
    username: 'shared.one',
    firstName: 'Shared',
    lastName: 'One',
    email: 'shared@cruxcare.app',
    phone: '+2348090000001',
    avatarUrl: null,
    roles: ['client'],
    capabilities: ['orders.place', 'appointments.book', 'health-profile.write'],
    referredBySource: 'other',
    membership: null,
    therapistProfile: null,
    biometricEnabled: false,
    createdAt: '2026-08-11T00:00:00Z',
    password: 'Passw0rd!1',
  },
  {
    id: 'shared-email-user-2',
    username: 'shared.two',
    firstName: 'Shared',
    lastName: 'Two',
    email: 'shared@cruxcare.app',
    phone: '+2348090000002',
    avatarUrl: null,
    roles: ['client'],
    capabilities: ['orders.place', 'appointments.book', 'health-profile.write'],
    referredBySource: 'other',
    membership: null,
    therapistProfile: null,
    biometricEnabled: false,
    createdAt: '2026-08-11T00:00:00Z',
    password: 'Passw0rd!1',
  },
];

/** 5 digits — matches the OTP input length (CA3 screenshot draws 5 boxes). */
export const otpCode = '12345';
export const loginAttempts = new Map<string, number>();

export const products: Product[] = [
  {
    id: 'prod-1',
    name: 'Cayenne Miracle Capsules',
    description: 'Traditional cayenne blend to support circulation and warmth.',
    price: 18.5,
    currency: 'USD',
    stock: 42,
    category: 'Capsules',
    media: [{ url: pCayenmis, alt: 'Cayenne Miracle Capsules' }],
  },
  {
    id: 'prod-2',
    name: 'Green Tea Wellness Blend',
    description: 'Antioxidant-rich green tea for daily wellness.',
    price: 12.0,
    currency: 'USD',
    stock: 76,
    category: 'Teas',
    media: [{ url: pGreenTea, alt: 'Green Tea Wellness Blend' }],
  },
  {
    id: 'prod-3',
    name: 'Ginger Powder — Gim Blend',
    description: 'Cold-pressed ginger powder for digestion and immunity.',
    price: 9.75,
    currency: 'USD',
    stock: 0,
    category: 'Spices',
    media: [{ url: pGimPowder, alt: 'Ginger Powder' }],
  },
  {
    id: 'prod-4',
    name: 'Capsicum Pain Relief Plaster',
    description: 'Topical plaster for joint and muscle discomfort.',
    price: 6.25,
    currency: 'USD',
    stock: 120,
    category: 'Topicals',
    media: [{ url: pCapsicumPlaster, alt: 'Capsicum Plaster' }],
  },
  {
    id: 'prod-5',
    name: 'Lumbar Support Stretcher',
    description: 'Gentle at-home stretcher for lower back tension.',
    price: 34.0,
    currency: 'USD',
    stock: 15,
    category: 'Devices',
    media: [{ url: pLumbarStretcher, alt: 'Lumbar Stretcher' }],
  },
  {
    id: 'prod-6',
    name: "Cacci-Gart Root Extract",
    description: 'Concentrated root extract, a CruxCare heritage formula.',
    price: 22.0,
    currency: 'USD',
    stock: 8,
    category: 'Extracts',
    media: [{ url: pCaccigart, alt: 'Cacci-Gart Root Extract' }],
  },
];

export const carts = new Map<string, Cart>();
export function getCart(userId: string): Cart {
  if (!carts.has(userId)) carts.set(userId, { items: [], subtotal: 0, currency: 'USD' });
  return carts.get(userId)!;
}
/** Test-only isolation: this in-memory store otherwise persists across
 * tests in the same file, since it stands in for a real backend's state. */
export function resetCart(userId: string) {
  carts.set(userId, { items: [], subtotal: 0, currency: 'USD' });
}
export function recalcCart(cart: Cart) {
  cart.subtotal = cart.items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
}

export const orders: Order[] = [];

export const therapists: TherapistSummary[] = [
  {
    id: 'therapist-1',
    name: 'Amaka Obi',
    avatarUrl: null,
    specialties: ['Physiotherapy', 'Pain management'],
    rating: 4.8,
    location: 'Lagos, Nigeria',
    bio: 'Supports recovery, mobility, and sustainable pain management through practical, client-centred care.',
    experienceYears: 8,
    languages: ['English', 'Igbo'],
    nextAvailableSlot: '2026-08-11T10:00:00Z',
    fullyBooked: false,
    schedulePublished: true,
  },
  {
    id: 'therapist-2',
    name: 'Chidi Nwosu',
    avatarUrl: null,
    specialties: ['Nutrition therapy'],
    rating: 4.6,
    location: 'Abuja, Nigeria',
    bio: 'Helps clients build realistic nutrition habits that support long-term wellness.',
    experienceYears: 6,
    languages: ['English', 'Hausa'],
    nextAvailableSlot: null,
    fullyBooked: true,
    schedulePublished: true,
  },
  {
    id: 'therapist-3',
    name: 'Ifeoma Eze',
    avatarUrl: null,
    specialties: ['Elder care', 'Wellness coaching'],
    rating: 4.9,
    location: 'Port Harcourt, Nigeria',
    bio: 'Provides compassionate support for ageing well, daily independence, and whole-person wellness.',
    experienceYears: 10,
    languages: ['English', 'Igbo'],
    // Never set working hours — the state every therapist starts in, and the
    // one the card used to describe as "Fully booked".
    nextAvailableSlot: null,
    fullyBooked: false,
    schedulePublished: false,
  },
];

export const appointments: Appointment[] = [
  {
    id: 'appt-1',
    clientId: 'user-1',
    clientName: 'Amaka Obi',
    therapistId: 'therapist-1',
    therapistName: 'Amaka Obi',
    slot: '2026-08-11T10:00:00Z',
    type: 'video',
    status: 'confirmed',
    reason: 'Follow-up on lower back plan',
    cancellationCutoff: '2026-08-11T08:00:00Z',
  },
];

export const healthProfiles = new Map<string, HealthProfile>();
healthProfiles.set('user-1', {
  clientId: 'user-1',
  sections: [
    { key: 'conditions', label: 'Existing conditions', value: 'Mild lower back strain' },
    { key: 'allergies', label: 'Allergies', value: null },
    { key: 'medications', label: 'Current medications', value: null },
  ],
  consentVersion: 'v1',
  consentedAt: '2025-11-02T00:00:00Z',
  lastUpdatedAt: '2025-11-02T00:00:00Z',
});

/**
 * The cadences a client is offered (D2b). Priced by the server in the real
 * thing; here they are fixed so the screen has the four drawn rows plus the
 * "Most chosen" pill on one of them.
 */
export const carePlanOptions: CarePlanOption[] = [
  {
    id: 'plan-weekly-1m',
    cadence: 'weekly',
    title: '1 visit a week',
    durationLabel: '1 month',
    visits: 4,
    durationDays: 30,
    amountMinor: 4000,
    perVisitMinor: 1000,
    currency: 'USD',
    recommended: false,
  },
  {
    id: 'plan-twice-3m',
    cadence: 'twice-weekly',
    title: '2 visits a week',
    durationLabel: '3 months',
    visits: 24,
    durationDays: 90,
    amountMinor: 21000,
    perVisitMinor: 875,
    currency: 'USD',
    recommended: true,
  },
  {
    id: 'plan-thrice-6m',
    cadence: 'thrice-weekly',
    title: '3 visits a week',
    durationLabel: '6 months',
    visits: 72,
    durationDays: 180,
    amountMinor: 39000,
    perVisitMinor: 542,
    currency: 'USD',
    recommended: false,
  },
  {
    id: 'plan-thrice-1y',
    cadence: 'thrice-weekly',
    title: '3 visits a week',
    durationLabel: '1 year',
    visits: 144,
    durationDays: 365,
    amountMinor: 72000,
    perVisitMinor: 500,
    currency: 'USD',
    recommended: false,
  },
];

export const careSubscriptions: CareSubscription[] = [];

export const caseFiles: CaseFile[] = [
  {
    id: 'case-1',
    clientId: 'user-1',
    clientName: 'Amaka Obi',
    therapistId: 'therapist-1',
    notes: [
      {
        id: 'note-1',
        authorId: 'therapist-1',
        body: 'Initial assessment: mild lumbar strain, recommended stretching routine.',
        createdAt: '2025-12-01T09:00:00Z',
        draft: false,
      },
    ],
    recommendations: [
      {
        id: 'rec-1',
        productId: 'prod-5',
        productName: 'Lumbar Support Stretcher',
        note: 'Use nightly for 10 minutes.',
        orderId: null,
      },
    ],
    sessionCount: 3,
    lastSessionAt: '2026-07-28T10:00:00Z',
    status: 'active',
    diagnosis: 'Mild lumbar strain with reduced flexion',
    treatmentPlan: {
      planId: null,
      cadence: null,
      startDate: null,
      endDate: null,
      summary: null,
      proposedAt: null,
      agreedAt: null,
    },
    subscription: null,
    treatmentStartedAt: null,
    healthProfileAccess: {
      status: 'pending',
      reason: 'To check for conditions that affect which exercises are safe to prescribe.',
      requestedAt: new Date(Date.now() - 36e5 * 30).toISOString(),
      respondedAt: null,
    },
  },
];

export const chatThreads: ChatThread[] = [
  {
    id: 'thread-1',
    participantId: 'therapist-1',
    participantName: 'Amaka Obi (Therapist)',
    participantAvatarUrl: null,
    lastMessage: null,
    lastMessageAt: null,
    unreadCount: 0,
    muted: false,
    status: 'open',
    closesAt: null,
    closedReason: null,
  },
  /** A closed thread, so the read-only composer state has something to render. */
  {
    id: 'thread-2',
    participantId: 'therapist-2',
    participantName: 'Chidi Nwosu',
    participantAvatarUrl: null,
    lastMessage: 'Take care, and book again whenever you need to.',
    lastMessageAt: '2026-07-12T16:20:00Z',
    unreadCount: 0,
    muted: false,
    status: 'read-only',
    closesAt: null,
    closedReason: 'Chat closed · sessions ended 12 Jul',
  },
];

export const chatMessages = new Map<string, ChatMessage[]>();
chatMessages.set('thread-1', [
  {
    id: 'msg-1',
    threadId: 'thread-1',
    senderId: 'therapist-1',
    body: 'Hi Amaka, how has the stretching routine been going?',
    attachments: [],
    createdAt: '2026-08-07T09:00:00Z',
    read: true,
  },
]);
// The list carries preview text, not a message record.
chatThreads[0].lastMessage = chatMessages.get('thread-1')![0].body;
chatThreads[0].lastMessageAt = chatMessages.get('thread-1')![0].createdAt;

/**
 * Which local currency each mock user resolves to, standing in for the country
 * on their profile address. `user-1` has one so the local-display path is
 * exercisable; a registered user has none, which is the common real case and
 * must render as plain USD.
 */
export const userCurrency = new Map<string, string>([['user-1', 'NGN']]);

export const currencyIndex: CurrencyIndex = {
  base: 'USD',
  source: 'official',
  supported: [
    {
      countryId: 126,
      country: 'Nigeria',
      currency: 'NGN',
      rate: 1351.051935,
      rateSource: 'official',
      fundable: true,
    },
    {
      countryId: 83,
      country: 'Ghana',
      currency: 'GHS',
      rate: 11.0632,
      rateSource: 'official',
      fundable: true,
    },
    // Supported but unpriced: the UI must hide it from funding rather than
    // showing a zero rate.
    {
      countryId: 40,
      country: 'Cameroon',
      currency: 'XAF',
      rate: null,
      rateSource: 'system',
      fundable: false,
    },
  ],
  mine: null,
};

export function currencyFor(userId: string): SupportedCurrency | null {
  const code = userCurrency.get(userId);
  if (!code) return null;
  const found = currencyIndex.supported.find((c) => c.currency === code);
  return found?.rate === null ? null : (found ?? null);
}

/**
 * Builds the display-only twin of a money object. The server converts, so the
 * mock does too — the client must never do this arithmetic itself.
 */
export function localBlockFor<K extends string>(
  userId: string,
  amounts: Record<K, number | null | undefined>,
): (LocalBlock<K> & { rate: number }) | null {
  const currency = currencyFor(userId);
  if (!currency || currency.rate === null) return null;

  const rate = currency.rate;
  const converted = Object.fromEntries(
    Object.entries(amounts).map(([key, value]) => [
      key,
      typeof value === 'number' ? Math.round(value * rate * 100) / 100 : null,
    ]),
  ) as Record<K, number | null>;

  return {
    currency: currency.currency,
    country: currency.country,
    rate,
    rateSource: currency.rateSource,
    ...converted,
  };
}

export const wallets = new Map<string, Wallet>();
wallets.set('user-1', {
  available: 248.5,
  pending: 0,
  committed: 2000,
  cooperativeSaved: 180,
  currency: 'USD',
  lastUpdatedAt: new Date().toISOString(),
  // Filled in per request by the handler, which is where the live rate lives.
  local: null,
});

export const ledgers = new Map<string, Transaction[]>();
ledgers.set('user-1', [
  {
    id: 'txn-0',
    reference: 'TOPUP-90400',
    type: 'deposit',
    amount: 285,
    fee: 0,
    currency: 'USD',
    description: 'Wallet funding',
    createdAt: '2026-07-31T00:00:00Z',
  },
  {
    id: 'txn-1',
    reference: 'REF-90436',
    type: 'order-payment',
    amount: -46.5,
    fee: 0,
    currency: 'USD',
    description: 'Order #1042',
    createdAt: '2026-08-03T00:00:00Z',
  },
  {
    id: 'txn-2',
    reference: 'REF-90412',
    type: 'rank-earning',
    amount: 10,
    fee: 0,
    currency: 'USD',
    description: 'Rank monthly earning',
    createdAt: '2026-08-01T00:00:00Z',
  },
]);

/** Care requests are per-client; the map key is the client's user id. */
export const careRequests = new Map<string, CareRequest[]>();

export function careRequestsFor(userId: string): CareRequest[] {
  const existing = careRequests.get(userId);
  if (existing) return existing;
  const created: CareRequest[] = [];
  careRequests.set(userId, created);
  return created;
}

/**
 * Which therapist profile a signed-in user practises as. Mock-only: the real
 * API resolves this from the account server-side and never accepts a therapist
 * id from the client. It exists here because the fixtures keep `users` and
 * `therapists` as separate lists with no link between them.
 */
export const therapistIdForUser = new Map<string, string>([['user-1', 'therapist-1']]);

/**
 * Every request naming this therapist, across all clients, newest first. The
 * per-client map cannot answer this on its own — which is exactly the shape
 * the real backend has to provide for `GET /therapist/care-requests`.
 */
export function careRequestsForTherapist(
  therapistId: string,
): Array<{ clientId: string; request: CareRequest }> {
  const matches: Array<{ clientId: string; request: CareRequest }> = [];
  for (const [clientId, requests] of careRequests) {
    for (const request of requests) {
      if (request.therapistId === therapistId) matches.push({ clientId, request });
    }
  }
  return matches.sort((a, b) => b.request.createdAt.localeCompare(a.request.createdAt));
}

export const notifications: AppNotification[] = [
  {
    id: 'notif-1',
    category: 'appointments',
    title: 'Appointment confirmed',
    body: 'Your session with Amaka Obi is confirmed for 11 Aug, 10:00.',
    read: false,
    actionLabel: 'View appointment',
    actionRoute: '/care/appointments/appt-1',
    createdAt: '2026-08-06T12:00:00Z',
  },
];

export function resolveLoginIdentifier(identifier: string): {
  user?: StoredUser;
  ambiguousEmail: boolean;
} {
  const usernameMatch = users.find((user) => user.username === identifier);
  if (usernameMatch) return { user: usernameMatch, ambiguousEmail: false };

  const emailMatches = users.filter((user) => user.email === identifier);
  return { user: emailMatches.length === 1 ? emailMatches[0] : undefined, ambiguousEmail: emailMatches.length > 1 };
}

export function findUserByCredentials(identifier: string): StoredUser | undefined {
  return resolveLoginIdentifier(identifier).user;
}

export function toPublicUser(user: StoredUser): User {
  // `username` is kept: it is the handle people sign in with, and the profile
  // shows it precisely because a shared email address is refused and they are
  // told to use it instead. Only the password is withheld.
  const { password: _password, ...publicUser } = user;
  return publicUser;
}

/**
 * Support tickets raised from the phone, newest first.
 *
 * `userId` is local to the fixture. The real API never sends it — it scopes to
 * the session instead — so it is not on the wire type, and the handler filters
 * on it here to reproduce that scoping rather than trusting the caller.
 */
export type StoredSupportTicket = SupportTicket & { userId: string };

export const supportTickets: StoredSupportTicket[] = [];

let nextTicketSequence = 1;

export function nextTicketReference(): string {
  const letter = String.fromCharCode(65 + (nextTicketSequence % 26));
  return `${letter}${Date.now()}${nextTicketSequence++}`;
}

/**
 * Therapist rotas, keyed by therapist id.
 *
 * A therapist absent from here has set no working hours, which is the state
 * every account starts in — deliberately not the same as being closed all week,
 * and the reason `therapist-3` is bookable by nobody until someone sets one.
 */
export const therapistRotas: Record<string, WorkingDay[]> = {
  'therapist-1': [
    { weekday: 1, opensAt: '09:00', closesAt: '17:00' },
    { weekday: 3, opensAt: '09:00', closesAt: '17:00' },
    { weekday: 5, opensAt: '09:00', closesAt: '13:00' },
  ],
  'therapist-2': [{ weekday: 2, opensAt: '10:00', closesAt: '16:00' }],
};

/**
 * Standing decisions about who may read a client's health profile.
 *
 * Seeded with one pending request so the screen has the case that matters —
 * a therapist waiting on an answer — without anyone having to arrange it.
 */
export const healthProfileAccess: HealthProfileAccess[] = [
  {
    id: 'hpa-1',
    therapistId: 'therapist-1',
    therapistName: 'Amaka Obi',
    clientId: 'user-1',
    status: 'pending',
    reason: 'To check for conditions that affect which exercises are safe to prescribe.',
    requestedAt: new Date(Date.now() - 36e5 * 30).toISOString(),
    respondedAt: null,
  },
];
