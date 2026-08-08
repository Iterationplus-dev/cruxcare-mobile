import { http, HttpResponse, type HttpHandler } from 'msw';
import * as db from './db';
import type { RegisterPayload } from '@/api/auth.api';
import type { CreateAppointmentPayload } from '@/api/appointments.api';
import type { ProductQuery } from '@/api/products.api';
import type { CartItem, CheckoutQuote, Order } from '@/types/marketplace';
import type { HealthProfile } from '@/types/care';
import type { TherapistPlanTier, User } from '@/types/user';

const BASE = import.meta.env.VITE_API_BASE_URL;
const url = (path: string) => `${BASE}${path}`;

const tokens = new Map<string, string>(); // token -> userId

function issueToken(userId: string): string {
  const token = `mock-token-${userId}-${Date.now()}`;
  tokens.set(token, userId);
  return token;
}

function currentUser(request: Request) {
  const auth = request.headers.get('Authorization');
  const token = auth?.replace('Bearer ', '');
  const userId = token ? tokens.get(token) : undefined;
  if (!userId) return null;
  return db.users.find((u) => u.id === userId) ?? null;
}

function unauthorized() {
  return HttpResponse.json({ message: 'Session expired. Please log in again.' }, { status: 401 });
}

function paginate<T>(items: T[]) {
  return { data: items, meta: { nextCursor: null, hasMore: false } };
}

// ---------------------------------------------------------------------------
// Auth & account
// ---------------------------------------------------------------------------
const authHandlers: HttpHandler[] = [
  http.post(url('/auth/register'), async ({ request }) => {
    const body = (await request.json()) as RegisterPayload;
    const existing = db.findUserByCredentials(body.email);
    if (existing) {
      return HttpResponse.json(
        { message: 'That email is already registered.', errors: { email: ['Already taken.'] } },
        { status: 422 },
      );
    }
    const id = db.nextId('user');
    const user = {
      id,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      avatarUrl: null,
      roles: ['client'] as User['roles'],
      capabilities: ['orders.place', 'appointments.book', 'health-profile.write'] as User['capabilities'],
      referredBySource: body.referredBySource,
      membership: null,
      therapistProfile: null,
      biometricEnabled: false,
      createdAt: new Date().toISOString(),
      password: body.password,
    };
    db.users.push(user);
    db.wallets.set(id, { available: 0, pending: 0, currency: 'USD', lastUpdatedAt: new Date().toISOString() });
    db.ledgers.set(id, []);
    const token = issueToken(id);
    return HttpResponse.json({ user: db.toPublicUser(user), token });
  }),

  http.post(url('/auth/login'), async ({ request }) => {
    const { identifier, password } = (await request.json()) as {
      identifier: string;
      password: string;
    };
    const user = db.findUserByCredentials(identifier);
    const attempts = db.loginAttempts.get(identifier) ?? 0;

    if (!user || user.password !== password) {
      const nextAttempts = attempts + 1;
      db.loginAttempts.set(identifier, nextAttempts);
      return HttpResponse.json(
        {
          message: 'The email/phone and password combination is incorrect.',
          code: 'invalid_credentials',
          meta: { attemptsRemaining: Math.max(0, 5 - nextAttempts) },
        },
        { status: 401 },
      );
    }
    db.loginAttempts.delete(identifier);
    const token = issueToken(user.id);
    return HttpResponse.json({ user: db.toPublicUser(user), token });
  }),

  http.post(url('/auth/otp/request'), () => HttpResponse.json({ sent: true })),

  http.post(url('/auth/otp/verify'), async ({ request }) => {
    const { code } = (await request.json()) as { code: string };
    if (code !== db.otpCode) {
      return HttpResponse.json(
        {
          message: 'That code is incorrect.',
          code: 'otp_invalid',
          meta: { attemptsRemaining: 2 },
        },
        { status: 422 },
      );
    }
    return HttpResponse.json({ verified: true });
  }),

  http.post(url('/auth/biometric/enable'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    user.biometricEnabled = true;
    return HttpResponse.json({ enabled: true });
  }),

  http.post(url('/auth/logout'), ({ request }) => {
    const auth = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (auth) tokens.delete(auth);
    return HttpResponse.json({ loggedOut: true });
  }),

  http.post(url('/auth/password/forgot'), () => HttpResponse.json({ sent: true })),

  http.post(url('/auth/password/reset'), async ({ request }) => {
    const { identifier, code, newPassword } = (await request.json()) as {
      identifier: string;
      code: string;
      newPassword: string;
    };
    if (code !== db.otpCode) {
      return HttpResponse.json({ message: 'That code is incorrect.', code: 'otp_invalid' }, { status: 422 });
    }
    const user = db.findUserByCredentials(identifier);
    if (user) user.password = newPassword;
    return HttpResponse.json({ reset: true });
  }),

  http.post(url('/auth/recovery/assisted'), () =>
    HttpResponse.json({ caseNumber: `CASE-${Math.floor(10000 + Math.random() * 89999)}` }),
  ),

  http.post(url('/me/delete'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const { password } = (await request.json()) as { password: string };
    if (password !== user.password) {
      return HttpResponse.json({ message: 'That password is incorrect.' }, { status: 401 });
    }
    const deletionCompletesAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return HttpResponse.json({ deletionCompletesAt });
  }),

  http.get(url('/me'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    return HttpResponse.json(db.toPublicUser(user));
  }),

  http.patch(url('/me'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const patch = (await request.json()) as Partial<User>;
    Object.assign(user, patch);
    return HttpResponse.json(db.toPublicUser(user));
  }),

  http.post(url('/me/membership/link'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const { cruxId } = (await request.json()) as { cruxId: string };
    if (!/^[A-Z]{3}\d{4}[A-Z]{2}$/.test(cruxId)) {
      return HttpResponse.json(
        { message: 'That Crux ID format looks wrong.', errors: { cruxId: ['Invalid format.'] } },
        { status: 422 },
      );
    }
    user.membership = { cruxId, tier: 'Bronze · Unit Leader', joinedAt: new Date().toISOString() };
    if (!user.roles.includes('member')) user.roles.push('member');
    return HttpResponse.json(db.toPublicUser(user));
  }),

  http.post(url('/me/therapist/activate'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const { plan } = (await request.json()) as { plan: TherapistPlanTier };
    user.therapistProfile = {
      plan,
      status: 'active',
      clientLimit: plan === 'free-trial' ? 1 : null,
      caseFileLimit: plan === 'free-trial' ? 1 : null,
      clientCount: 0,
      caseFileCount: 0,
    };
    if (!user.roles.includes('therapist')) user.roles.push('therapist');
    return HttpResponse.json(db.toPublicUser(user));
  }),
];

// ---------------------------------------------------------------------------
// Marketplace & orders
// ---------------------------------------------------------------------------
const marketplaceHandlers: HttpHandler[] = [
  http.get(url('/products'), ({ request }) => {
    const params = new URL(request.url).searchParams;
    const query: ProductQuery = {
      search: params.get('search') ?? undefined,
      category: params.get('category') ?? undefined,
    };
    let list = db.products;
    if (query.search) {
      const q = query.search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (query.category) list = list.filter((p) => p.category === query.category);
    return HttpResponse.json(paginate(list));
  }),

  http.get(url('/products/:id'), ({ params }) => {
    const product = db.products.find((p) => p.id === params.id);
    if (!product) return HttpResponse.json({ message: 'Product not found.' }, { status: 404 });
    return HttpResponse.json(product);
  }),

  http.get(url('/cart'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    return HttpResponse.json(db.getCart(user.id));
  }),

  http.post(url('/cart/items'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const { productId, quantity } = (await request.json()) as {
      productId: string;
      quantity: number;
    };
    const product = db.products.find((p) => p.id === productId);
    if (!product) return HttpResponse.json({ message: 'Product not found.' }, { status: 404 });
    if (product.stock < quantity) {
      return HttpResponse.json({ message: 'Not enough stock available.' }, { status: 422 });
    }
    const cart = db.getCart(user.id);
    const existing = cart.items.find((i) => i.product.id === productId);
    if (existing) existing.quantity += quantity;
    else cart.items.push({ id: db.nextId('item'), product, quantity } as CartItem);
    db.recalcCart(cart);
    return HttpResponse.json(cart);
  }),

  http.delete(url('/cart/items/:id'), ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const cart = db.getCart(user.id);
    cart.items = cart.items.filter((i) => i.id !== params.id);
    db.recalcCart(cart);
    return HttpResponse.json(cart);
  }),

  http.get(url('/cart/checkout-quote'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const cart = db.getCart(user.id);
    const wallet = db.wallets.get(user.id);
    const quote: CheckoutQuote = {
      subtotal: cart.subtotal,
      fees: 0,
      total: cart.subtotal,
      currency: cart.currency,
      walletBalanceAfter: (wallet?.available ?? 0) - cart.subtotal,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
    return HttpResponse.json(quote);
  }),

  http.post(url('/orders'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const cart = db.getCart(user.id);
    if (cart.items.length === 0) {
      return HttpResponse.json({ message: 'Your cart is empty.' }, { status: 422 });
    }
    const order: Order = {
      id: db.nextId('order'),
      reference: `ORD-${Math.floor(10000 + Math.random() * 89999)}`,
      items: cart.items.map((i) => ({
        productId: i.product.id,
        productName: i.product.name,
        quantity: i.quantity,
        unitPrice: i.product.price,
      })),
      total: cart.subtotal,
      currency: cart.currency,
      status: 'confirmed',
      placedById: user.id,
      onBehalfOfId: null,
      timeline: [{ status: 'confirmed', at: new Date().toISOString() }],
      createdAt: new Date().toISOString(),
    };
    db.orders.push(order);
    cart.items = [];
    db.recalcCart(cart);

    const wallet = db.wallets.get(user.id);
    if (wallet) {
      wallet.available -= order.total;
      wallet.lastUpdatedAt = new Date().toISOString();
      const ledger = db.ledgers.get(user.id) ?? [];
      ledger.unshift({
        id: db.nextId('txn'),
        reference: order.reference,
        type: 'order-payment',
        amount: -order.total,
        fee: 0,
        currency: order.currency,
        description: `Order ${order.reference}`,
        createdAt: order.createdAt,
      });
      db.ledgers.set(user.id, ledger);
    }

    return HttpResponse.json(order);
  }),

  http.get(url('/orders'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    return HttpResponse.json(paginate(db.orders.filter((o) => o.placedById === user.id)));
  }),

  http.get(url('/orders/:id'), ({ params }) => {
    const order = db.orders.find((o) => o.id === params.id);
    if (!order) return HttpResponse.json({ message: 'Order not found.' }, { status: 404 });
    return HttpResponse.json(order);
  }),
];

// ---------------------------------------------------------------------------
// Client care
// ---------------------------------------------------------------------------
const careHandlers: HttpHandler[] = [
  http.get(url('/therapists'), () => HttpResponse.json(paginate(db.therapists))),

  http.get(url('/therapists/:id'), ({ params }) => {
    const t = db.therapists.find((x) => x.id === params.id);
    if (!t) return HttpResponse.json({ message: 'Therapist not found.' }, { status: 404 });
    return HttpResponse.json(t);
  }),

  http.post(url('/care/requests'), () => HttpResponse.json({ requested: true })),

  http.get(url('/appointments'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    return HttpResponse.json(paginate(db.appointments.filter((a) => a.clientId === user.id)));
  }),

  http.post(url('/appointments'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const payload = (await request.json()) as CreateAppointmentPayload;
    const therapist = db.therapists.find((t) => t.id === payload.therapistId);
    const appt = {
      id: db.nextId('appt'),
      clientId: user.id,
      clientName: `${user.firstName} ${user.lastName}`,
      therapistId: payload.therapistId,
      therapistName: therapist?.name ?? 'Therapist',
      slot: payload.slot,
      type: payload.type,
      status: 'requested' as const,
      reason: null,
      cancellationCutoff: null,
    };
    db.appointments.push(appt);
    return HttpResponse.json(appt);
  }),

  http.patch(url('/appointments/:id'), async ({ params, request }) => {
    const appt = db.appointments.find((a) => a.id === params.id);
    if (!appt) return HttpResponse.json({ message: 'Appointment not found.' }, { status: 404 });
    const { status } = (await request.json()) as { status: typeof appt.status };
    appt.status = status;
    return HttpResponse.json(appt);
  }),

  http.get(url('/health-profile'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const profile = db.healthProfiles.get(user.id);
    if (!profile) return HttpResponse.json({ message: 'Not found.' }, { status: 404 });
    return HttpResponse.json(profile);
  }),

  http.put(url('/health-profile'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const body = (await request.json()) as {
      sections: HealthProfile['sections'];
      consentVersion: string;
    };
    const profile = {
      clientId: user.id,
      sections: body.sections,
      consentVersion: body.consentVersion,
      consentedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
    };
    db.healthProfiles.set(user.id, profile);
    return HttpResponse.json(profile);
  }),

  http.get(url('/case-files'), () => HttpResponse.json(paginate(db.caseFiles))),

  http.get(url('/case-files/:id'), ({ params }) => {
    const cf = db.caseFiles.find((c) => c.id === params.id);
    if (!cf) return HttpResponse.json({ message: 'Case file not found.' }, { status: 404 });
    return HttpResponse.json(cf);
  }),

  http.patch(url('/case-files/:id'), async ({ params, request }) => {
    const cf = db.caseFiles.find((c) => c.id === params.id);
    if (!cf) return HttpResponse.json({ message: 'Case file not found.' }, { status: 404 });
    const body = (await request.json()) as {
      note?: { body: string; draft: boolean };
      recommendation?: { productId: string; note: string | null };
    };
    if (body.note) {
      cf.notes.push({
        id: db.nextId('note'),
        authorId: cf.therapistId,
        body: body.note.body,
        createdAt: new Date().toISOString(),
        draft: body.note.draft,
      });
    }
    if (body.recommendation) {
      const product = db.products.find((p) => p.id === body.recommendation!.productId);
      cf.recommendations.push({
        id: db.nextId('rec'),
        productId: body.recommendation.productId,
        productName: product?.name ?? 'Product',
        note: body.recommendation.note,
        orderId: null,
      });
    }
    return HttpResponse.json(cf);
  }),

  http.get(url('/chat/threads'), () => HttpResponse.json(db.chatThreads)),

  http.get(url('/chat/threads/:id/messages'), ({ params }) => {
    const messages = db.chatMessages.get(params.id as string) ?? [];
    return HttpResponse.json(paginate(messages));
  }),

  http.post(url('/chat/threads/:id/messages'), async ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const { body } = (await request.json()) as { body: string };
    const threadId = params.id as string;
    const message = {
      id: db.nextId('msg'),
      threadId,
      senderId: user.id,
      body,
      attachments: [],
      sentAt: new Date().toISOString(),
      readAt: null,
    };
    const list = db.chatMessages.get(threadId) ?? [];
    list.push(message);
    db.chatMessages.set(threadId, list);
    const thread = db.chatThreads.find((t) => t.id === threadId);
    if (thread) thread.lastMessage = message;
    return HttpResponse.json(message);
  }),
];

// ---------------------------------------------------------------------------
// Wallet (read-only) & notifications
// ---------------------------------------------------------------------------
const walletHandlers: HttpHandler[] = [
  http.get(url('/wallet'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    return HttpResponse.json(
      db.wallets.get(user.id) ?? { available: 0, pending: 0, currency: 'USD', lastUpdatedAt: new Date().toISOString() },
    );
  }),

  http.get(url('/wallet/ledger'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    return HttpResponse.json(paginate(db.ledgers.get(user.id) ?? []));
  }),

  http.get(url('/notifications'), () => HttpResponse.json(db.notifications)),

  http.patch(url('/notifications/:id'), ({ params }) => {
    const n = db.notifications.find((x) => x.id === params.id);
    if (n) n.read = true;
    return HttpResponse.json({ ok: true });
  }),
];

export const handlers: HttpHandler[] = [
  ...authHandlers,
  ...marketplaceHandlers,
  ...careHandlers,
  ...walletHandlers,
];
