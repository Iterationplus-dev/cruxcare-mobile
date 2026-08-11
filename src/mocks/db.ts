import type { Appointment, CaseFile, ChatMessage, ChatThread, HealthProfile, TherapistSummary } from '@/types/care';
import type { Cart, Order, Product } from '@/types/marketplace';
import type { AppNotification } from '@/types/notifications';
import type { User } from '@/types/user';
import type { Transaction, Wallet } from '@/types/wallet';
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
    nextAvailableSlot: '2026-08-11T10:00:00Z',
    fullyBooked: false,
  },
  {
    id: 'therapist-2',
    name: 'Chidi Nwosu',
    avatarUrl: null,
    specialties: ['Nutrition therapy'],
    rating: 4.6,
    nextAvailableSlot: null,
    fullyBooked: true,
  },
  {
    id: 'therapist-3',
    name: 'Ifeoma Eze',
    avatarUrl: null,
    specialties: ['Elder care', 'Wellness coaching'],
    rating: 4.9,
    nextAvailableSlot: '2026-08-09T14:30:00Z',
    fullyBooked: false,
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
  },
];

export const chatThreads: ChatThread[] = [
  {
    id: 'thread-1',
    participants: [
      { id: 'user-1', name: 'Amaka Obi', avatarUrl: null, online: true },
      { id: 'therapist-1', name: 'Amaka Obi (Therapist)', avatarUrl: null, online: false },
    ],
    lastMessage: null,
    unreadCount: 0,
    scopeDisclaimer: 'This chat is for care coordination only — not for emergencies.',
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
    sentAt: '2026-08-07T09:00:00Z',
    readAt: '2026-08-07T09:05:00Z',
  },
]);
chatThreads[0].lastMessage = chatMessages.get('thread-1')![0];

export const wallets = new Map<string, Wallet>();
wallets.set('user-1', {
  available: 248.5,
  pending: 0,
  currency: 'USD',
  lastUpdatedAt: new Date().toISOString(),
});

export const ledgers = new Map<string, Transaction[]>();
ledgers.set('user-1', [
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

export function findUserByCredentials(identifier: string): StoredUser | undefined {
  return users.find((u) => u.email === identifier || u.phone === identifier);
}

export function toPublicUser(user: StoredUser): User {
  const { password: _password, ...publicUser } = user;
  return publicUser;
}
