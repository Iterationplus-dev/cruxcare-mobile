import { http, HttpResponse, type HttpHandler } from 'msw';
import * as db from './db';
import type { RegisterPayload } from '@/api/auth.api';
import type { CreateAppointmentPayload } from '@/api/appointments.api';
import type { ProductQuery } from '@/api/products.api';
import type { CartItem, CheckoutQuote, Order } from '@/types/marketplace';
import type { CareRequest, HealthProfile, TherapistCareRequest, WorkingDay } from '@/types/care';
import type { WalletTopUpQuote } from '@/types/wallet';
import type { TherapistPlanTier, User } from '@/types/user';
import { genderOptions } from '@/types/user';
import {
  MAX_SPECIALTIES,
  MAX_SPECIALTY_LENGTH,
  normalizeSpecialty,
} from '@/features/therapist/specialties';

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
      username: body.email,
      password: body.password,
    };
    db.users.push(user);
    db.wallets.set(id, { available: 0, pending: 0, currency: 'USD', lastUpdatedAt: new Date().toISOString(), local: null });
    db.ledgers.set(id, []);
    const token = issueToken(id);
    return HttpResponse.json({ user: db.toPublicUser(user), token });
  }),

  http.post(url('/auth/login'), async ({ request }) => {
    const { identifier, password } = (await request.json()) as {
      identifier: string;
      password: string;
    };
    const resolution = db.resolveLoginIdentifier(identifier);
    const user = resolution.user;
    const attempts = db.loginAttempts.get(identifier) ?? 0;

    if (resolution.ambiguousEmail) {
      return HttpResponse.json(
        {
          message: 'Multiple accounts use this email address. Enter your username to log in.',
          code: 'use_username',
        },
        { status: 401 },
      );
    }

    if (!user || user.password !== password) {
      const nextAttempts = attempts + 1;
      db.loginAttempts.set(identifier, nextAttempts);
      return HttpResponse.json(
        {
          message: 'Those details did not match our records.',
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

    // Null clears the field; anything outside the published list is rejected
    // rather than stored, so a typo cannot become a value the UI can't render.
    if ('gender' in patch && patch.gender !== null) {
      const allowed = genderOptions.map((o) => o.value) as readonly string[];
      if (!allowed.includes(String(patch.gender))) {
        // Laravel's top-level message is the first field error, so the two
        // cannot differ. Mirrored here so the mock cannot pass on a shape the
        // real API will never send.
        const message = 'That is not a gender we recognise.';
        return HttpResponse.json({ message, errors: { gender: [message] } }, { status: 422 });
      }
    }

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
    const { plan, paymentToken } = (await request.json()) as {
      plan: TherapistPlanTier;
      paymentToken: string;
    };

    // Mirrors the API: priced plans settle before they start, wallet is the
    // only token that settles here, and a gateway token stays pending.
    const priceMinor = plan === 'monthly' ? 1500 : plan === 'yearly' ? 20000 : 0;
    const payByWallet = paymentToken === 'wallet' || paymentToken.startsWith('wallet:');
    const wallet = db.wallets.get(user.id);

    if (priceMinor > 0) {
      if (!payByWallet) {
        return HttpResponse.json(
          {
            status: 'pending_payment',
            reference: `SUB-${Date.now()}`,
            plan,
            amount: priceMinor / 100,
            currency: wallet?.currency ?? 'USD',
            message: 'Your plan starts as soon as the payment is confirmed.',
          },
          { status: 202 },
        );
      }

      if ((wallet?.available ?? 0) * 100 < priceMinor) {
        return HttpResponse.json(
          {
            message: 'Your wallet balance is not enough for this plan.',
            code: 'insufficient_funds',
            meta: {
              available: wallet?.available ?? 0,
              required: priceMinor / 100,
              currency: wallet?.currency ?? 'USD',
            },
          },
          { status: 422 },
        );
      }

      if (wallet) wallet.available -= priceMinor / 100;
    }

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
/** The therapist's projection of a stored request: same record, same events,
 * but carrying the client rather than the therapist. */
function toTherapistCareRequest(clientId: string, request: CareRequest): TherapistCareRequest {
  const client = db.users.find((u) => u.id === clientId);
  const caseFile = db.caseFiles.find(
    (cf) => cf.clientId === clientId && cf.therapistId === request.therapistId,
  );
  return {
    id: request.id,
    reference: request.reference,
    status: request.status,
    reason: request.reason,
    clientId,
    clientName: client ? `${client.firstName} ${client.lastName}` : 'CruxCare client',
    clientAvatarUrl: client?.avatarUrl ?? null,
    caseFileId: caseFile?.id ?? null,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    events: request.events,
  };
}

/** Statuses a therapist can still answer. Anything else has been decided,
 * withdrawn, or closed, and the answer would be meaningless. */
const ANSWERABLE_STATUSES = ['submitted', 'in-review'];

function respondToCareRequest(request: Request, id: string, action: 'accept' | 'decline') {
  const user = currentUser(request);
  if (!user) return unauthorized();

  const therapistId = db.therapistIdForUser.get(user.id);
  if (!therapistId) {
    return HttpResponse.json({ message: 'You are not practising as a therapist.' }, { status: 403 });
  }

  const match = db
    .careRequestsForTherapist(therapistId)
    .find((entry) => entry.request.id === id);
  // Someone else's request is a 404, never a 403, which would confirm it exists.
  if (!match) return HttpResponse.json({ message: 'Request not found.' }, { status: 404 });

  const { clientId, request: careRequest } = match;

  // Re-accepting a request this therapist already accepted has the same
  // outcome as the first call, so it returns the record rather than an error
  // for something that worked. Every other settled state is still refused.
  if (action === 'accept' && careRequest.status === 'accepted') {
    return HttpResponse.json(toTherapistCareRequest(clientId, careRequest));
  }

  if (!ANSWERABLE_STATUSES.includes(String(careRequest.status))) {
    return HttpResponse.json(
      {
        message: 'This request has already moved on.',
        code: 'request_not_actionable',
        // The screen re-renders from this rather than trusting its own copy.
        meta: { status: careRequest.status },
      },
      { status: 422 },
    );
  }

  // Accepting takes on a client, so the plan is enforced here and not left to
  // the screen's disabled button — the limit is a server rule.
  const planActive =
    !!user.therapistProfile?.plan && user.therapistProfile.status === 'active';
  if (action === 'accept' && !planActive) {
    return HttpResponse.json(
      { message: 'Choose a plan before taking on a client.', code: 'therapist_plan_required' },
      { status: 422 },
    );
  }

  const now = new Date().toISOString();
  const therapistName = careRequest.therapistName ?? 'Your therapist';

  // Accepting is what opens the case file. Without this the therapist accepts
  // a client and then has nothing to open — the record has to exist before the
  // screen offers a way into it.
  if (action === 'accept') {
    const existing = db.caseFiles.find(
      (cf) => cf.clientId === clientId && cf.therapistId === therapistId,
    );
    if (!existing) {
      const client = db.users.find((u) => u.id === clientId);
      db.caseFiles.push({
        id: db.nextId('case'),
        clientId,
        clientName: client ? `${client.firstName} ${client.lastName}` : 'CruxCare client',
        therapistId,
        notes: [],
        recommendations: [],
        sessionCount: 0,
        lastSessionAt: null,
      });
    }
  }

  careRequest.status = action === 'accept' ? 'accepted' : 'declined';
  careRequest.updatedAt = now;
  careRequest.events.push({
    id: db.nextId('care-evt'),
    status: careRequest.status,
    // Written for the client, who reads this same trail on their own screen.
    label:
      action === 'accept'
        ? `${therapistName} accepted your request`
        : `${therapistName} could not take this case`,
    note:
      action === 'accept'
        ? 'You can now message them and book a session from Care.'
        : 'CruxCare can match you with another therapist.',
    at: now,
  });

  db.notifications.unshift({
    id: `notif-care-${action}-${Date.now()}`,
    category: 'system',
    title: action === 'accept' ? 'Therapist accepted your request' : 'Therapist request declined',
    body: careRequest.events[careRequest.events.length - 1].label,
    read: false,
    actionLabel: 'Track request',
    actionRoute: '/care/requests',
    createdAt: now,
  });

  return HttpResponse.json(toTherapistCareRequest(clientId, careRequest));
}

/** Resolves the therapist record the signed-in account practises as. */
function currentTherapistProfile(request: Request) {
  const user = currentUser(request);
  if (!user) return null;
  const therapistId = db.therapistIdForUser.get(user.id);
  if (!therapistId) return null;
  return db.therapists.find((t) => t.id === therapistId) ?? null;
}

function therapistProfileMissing(request: Request) {
  if (!currentUser(request)) return unauthorized();
  return HttpResponse.json({ message: 'You are not practising as a therapist.' }, { status: 403 });
}

/** Returns a message when the list is unusable, or null when it is fine. */
function validateSpecialties(value: unknown): string | null {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    return 'Send areas of specialization as a list of text values.';
  }

  const cleaned = value.map((v) => normalizeSpecialty(v as string));

  if (cleaned.some((v) => !v)) return 'Areas of specialization cannot be blank.';
  if (cleaned.some((v) => v.length > MAX_SPECIALTY_LENGTH)) {
    return `Keep each area under ${MAX_SPECIALTY_LENGTH} characters.`;
  }
  if (cleaned.length > MAX_SPECIALTIES) return `You can list up to ${MAX_SPECIALTIES} areas.`;

  const seen = new Set(cleaned.map((v) => v.toLowerCase()));
  if (seen.size !== cleaned.length) return 'That area is already on your profile.';

  return null;
}

const careHandlers: HttpHandler[] = [
  http.get(url('/therapists'), () => HttpResponse.json(paginate(db.therapists))),

  http.get(url('/therapists/:id'), ({ params }) => {
    const t = db.therapists.find((x) => x.id === params.id);
    if (!t) return HttpResponse.json({ message: 'Therapist not found.' }, { status: 404 });
    return HttpResponse.json(t);
  }),

  /**
   * The therapist's open days across a range.
   *
   * Built from their rota, so a therapist who has set no hours returns nothing
   * at all rather than a fortnight of office hours nobody agreed to.
   */
  http.get(url('/therapists/:id/availability'), ({ params, request }) => {
    const therapist = db.therapists.find((x) => x.id === params.id);
    if (!therapist) return HttpResponse.json({ message: 'Therapist not found.' }, { status: 404 });

    const rota = db.therapistRotas[String(params.id)] ?? [];
    if (rota.length === 0 || therapist.fullyBooked) return HttpResponse.json(paginate([]));

    const query = new URL(request.url).searchParams;
    const from = new Date(`${query.get('from') ?? new Date().toISOString().slice(0, 10)}T00:00:00`);
    const to = new Date(`${query.get('to') ?? query.get('from') ?? from.toISOString().slice(0, 10)}T00:00:00`);

    const days: { date: string; slots: string[] }[] = [];
    for (const day = new Date(from); day <= to; day.setDate(day.getDate() + 1)) {
      const working = rota.find((w) => w.weekday === day.getDay());
      const slots: string[] = [];

      if (working) {
        const [openHour] = working.opensAt.split(':').map(Number);
        const [closeHour] = working.closesAt.split(':').map(Number);
        for (let hour = openHour; hour < closeHour; hour += 1) {
          slots.push(`${String(hour).padStart(2, '0')}:00`);
        }
      }

      days.push({ date: day.toISOString().slice(0, 10), slots });
    }

    return HttpResponse.json(paginate(days));
  }),

  /**
   * The signed-in therapist's own rota, in their own clock. Empty `days` means
   * no hours set; a null `timezone` means they have never been asked, and the
   * hours then read as UTC.
   */
  http.get(url('/me/therapist/availability'), ({ request }) => {
    const profile = currentTherapistProfile(request);
    if (!profile) return therapistProfileMissing(request);
    return HttpResponse.json({
      timezone: 'Africa/Lagos',
      days: db.therapistRotas[profile.id] ?? [],
    });
  }),

  /** A PUT, so what is sent replaces the week and `[]` genuinely clears it. */
  http.put(url('/me/therapist/availability'), async ({ request }) => {
    const profile = currentTherapistProfile(request);
    if (!profile) return therapistProfileMissing(request);

    const body = (await request.json()) as { days?: unknown };
    if (!Array.isArray(body.days)) {
      return HttpResponse.json(
        { message: 'Send the full week, or an empty list to clear your hours.' },
        { status: 422 },
      );
    }

    const days = body.days as WorkingDay[];

    if (days.some((d) => d.closesAt <= d.opensAt)) {
      return HttpResponse.json(
        { message: 'A day has to close after it opens.' },
        { status: 422 },
      );
    }

    const sorted = [...days].sort((a, b) => a.weekday - b.weekday);
    db.therapistRotas[profile.id] = sorted;
    // The directory reads this to decide between "no hours set" and a real
    // absence of slots, so it has to move with the rota.
    profile.schedulePublished = sorted.length > 0;

    return HttpResponse.json({ timezone: 'Africa/Lagos', days: sorted });
  }),

  http.get(url('/me/therapist/profile'), ({ request }) => {
    const profile = currentTherapistProfile(request);
    if (!profile) return therapistProfileMissing(request);
    return HttpResponse.json(profile);
  }),

  http.patch(url('/me/therapist/profile'), async ({ request }) => {
    const profile = currentTherapistProfile(request);
    if (!profile) return therapistProfileMissing(request);

    const patch = (await request.json()) as { specialties?: unknown };

    if ('specialties' in patch) {
      const invalid = validateSpecialties(patch.specialties);
      if (invalid) {
        return HttpResponse.json(
          { message: invalid, errors: { specialties: [invalid] } },
          { status: 422 },
        );
      }
      // Stored normalized so what clients read matches what was typed once
      // whitespace is settled.
      profile.specialties = (patch.specialties as string[]).map(normalizeSpecialty);
    }

    return HttpResponse.json(profile);
  }),

  http.post(url('/care/requests'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const { reason, therapistId } = (await request.json()) as { reason: string; therapistId?: string };

    const therapist = therapistId ? db.therapists.find((t) => t.id === therapistId) : undefined;
    if (therapistId && !therapist) {
      return HttpResponse.json(
        { message: 'That therapist is not taking requests.', code: 'therapist_unavailable' },
        { status: 422 },
      );
    }

    const now = new Date().toISOString();
    const created: CareRequest = {
      id: db.nextId('care-req'),
      reference: `CR-${Date.now()}`,
      // A named therapist already has it; an open request is waiting to be
      // picked up. That is the difference the two statuses carry.
      status: therapist ? 'in-review' : 'submitted',
      reason,
      therapistId: therapistId ?? null,
      therapistName: therapist?.name ?? null,
      therapistAvatarUrl: therapist?.avatarUrl ?? null,
      createdAt: now,
      updatedAt: now,
      events: [
        {
          id: db.nextId('care-evt'),
          status: therapist ? 'in-review' : 'submitted',
          label: therapist ? `Request sent to ${therapist.name}` : 'Request submitted',
          note: therapist
            ? 'They have been notified and will respond shortly.'
            : 'A coordinator will match you with an available therapist.',
          at: now,
        },
      ],
    };
    db.careRequestsFor(user.id).unshift(created);

    // Mirrors the API: a named therapist is attached and notified, an
    // unnamed request stays open for staff matching.
    if (therapistId) {
      db.notifications.unshift({
        id: `notif-care-${Date.now()}`,
        // The API maps its `cases` notification type onto `system`.
        category: 'system',
        title: 'New client request',
        body: reason,
        read: false,
        actionLabel: 'View requests',
        actionRoute: '/therapist/care-requests',
        createdAt: now,
      });
    }

    // The client's own confirmation. Persist-then-push: the inbox row exists
    // before any notification could reference it.
    db.notifications.unshift({
      id: `notif-care-sent-${Date.now()}`,
      category: 'system',
      title: 'Therapist request sent',
      body: therapist
        ? `${therapist.name} has been notified. We will tell you as soon as they respond.`
        : 'CruxCare is matching you with an available therapist.',
      read: false,
      actionLabel: 'Track request',
      actionRoute: '/care/requests',
      createdAt: now,
    });

    return HttpResponse.json(created, { status: 202 });
  }),

  http.get(url('/care/requests'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    return HttpResponse.json(paginate(db.careRequestsFor(user.id)));
  }),

  http.get(url('/care/requests/:id'), ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const key = String(params.id);
    const found = db.careRequestsFor(user.id).find((r) => r.id === key || r.reference === key);
    // 404 rather than 403 on someone else's request: a 403 would confirm it exists.
    if (!found) return HttpResponse.json({ message: 'Request not found.' }, { status: 404 });
    return HttpResponse.json(found);
  }),

  http.post(url('/care/requests/:id/cancel'), ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const found = db.careRequestsFor(user.id).find((r) => r.id === params.id);
    if (!found) return HttpResponse.json({ message: 'Request not found.' }, { status: 404 });

    if (found.status === 'accepted' || found.status === 'closed' || found.status === 'cancelled') {
      return HttpResponse.json(
        {
          message: 'This request can no longer be cancelled.',
          code: 'request_not_cancellable',
          // The client re-renders from this rather than trusting its own copy.
          meta: { status: found.status },
        },
        { status: 422 },
      );
    }

    const now = new Date().toISOString();
    found.status = 'cancelled';
    found.updatedAt = now;
    found.events.push({
      id: db.nextId('care-evt'),
      status: 'cancelled',
      label: 'You withdrew this request',
      note: null,
      at: now,
    });
    return HttpResponse.json(found);
  }),

  // -- Therapist side of the same request -----------------------------------
  // `GET /care/requests` is scoped to the caller's own requests as a client, so
  // it can never surface these. This is the therapist's queue.
  http.get(url('/therapist/care-requests'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const therapistId = db.therapistIdForUser.get(user.id);
    // Not practising as a therapist: an empty queue, not an error.
    if (!therapistId) return HttpResponse.json(paginate([]));

    const queue = db
      .careRequestsForTherapist(therapistId)
      .map(({ clientId, request: careRequest }) => toTherapistCareRequest(clientId, careRequest));
    return HttpResponse.json(paginate(queue));
  }),

  http.post(url('/therapist/care-requests/:id/accept'), ({ request, params }) =>
    respondToCareRequest(request, String(params.id), 'accept'),
  ),

  http.post(url('/therapist/care-requests/:id/decline'), ({ request, params }) =>
    respondToCareRequest(request, String(params.id), 'decline'),
  ),

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

  /**
   * Moving an appointment. A past slot is fine as the source — a missed session
   * is the main reason anyone reschedules — but the destination must be ahead.
   */
  http.post(url('/appointments/:id/reschedule'), async ({ params, request }) => {
    const appt = db.appointments.find((a) => a.id === params.id);
    if (!appt) return HttpResponse.json({ message: 'Appointment not found.' }, { status: 404 });

    if (appt.status === 'completed' || appt.status === 'cancelled') {
      return HttpResponse.json(
        {
          message: `A ${appt.status} appointment cannot be moved. Book a new one instead.`,
          code: 'appointment_not_reschedulable',
        },
        { status: 422 },
      );
    }

    const body = (await request.json()) as { slot: string; type?: typeof appt.type };

    if (new Date(body.slot).getTime() <= Date.now()) {
      return HttpResponse.json(
        { message: 'Choose a time in the future.', code: 'slot_in_past' },
        { status: 422 },
      );
    }

    appt.slot = body.slot;
    if (body.type) appt.type = body.type;
    // The therapist agreed to a time, not to whichever time it is moved to.
    appt.status = 'requested';

    return HttpResponse.json(appt);
  }),

  http.get(url('/support/tickets'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    // Scoped to the caller: a ticket carries the details of someone's account.
    return HttpResponse.json(paginate(db.supportTickets.filter((t) => t.userId === user.id)));
  }),

  http.post(url('/support/tickets'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();

    const body = (await request.json()) as { message?: string; subject?: string; category?: string };
    const message = (body.message ?? '').trim();

    if (message.length < 10) {
      return HttpResponse.json(
        {
          message:
            message.length === 0
              ? 'Tell us what you need help with.'
              : 'Please add a little more detail so support can help.',
          errors: { message: ['Tell us what you need help with.'] },
        },
        { status: 422 },
      );
    }

    const category = body.category ?? 'General Enquiries';
    const now = new Date().toISOString();
    const ticket = {
      id: `ticket-${db.supportTickets.length + 1}`,
      userId: user.id,
      reference: db.nextTicketReference(),
      subject: (body.subject ?? '').trim() || category,
      message,
      category,
      status: 'Open' as const,
      reply: null,
      createdAt: now,
      updatedAt: now,
    };

    db.supportTickets.unshift(ticket);

    return HttpResponse.json(ticket, { status: 201 });
  }),

  /**
   * Who has asked to read the caller's health profile. Acceptance of a care
   * request lets a therapist ask; only the answer here gives them access.
   */
  http.post(url('/auth/two-factor'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const { enabled } = (await request.json()) as { enabled: boolean };
    user.twoFactorEnabled = enabled;
    return HttpResponse.json(db.toPublicUser(user));
  }),

  http.patch(url('/me/payment-preferences'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const patch = (await request.json()) as {
      payFromWalletFirst?: boolean;
      saveMethods?: boolean;
    };
    // Both default to the behaviour the app already had.
    const current = user.paymentPreferences ?? { payFromWalletFirst: true, saveMethods: true };
    user.paymentPreferences = { ...current, ...patch };
    return HttpResponse.json(db.toPublicUser(user));
  }),

  http.get(url('/health-profile/access'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    return HttpResponse.json(paginate(db.healthProfileAccess.filter((a) => a.clientId === user.id)));
  }),

  http.post(url('/health-profile/access/:id/grant'), ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const row = db.healthProfileAccess.find((a) => a.id === params.id && a.clientId === user.id);
    if (!row) return HttpResponse.json({ message: 'Not found.' }, { status: 404 });
    row.status = 'granted';
    row.respondedAt = new Date().toISOString();
    return HttpResponse.json(row);
  }),

  /** Answers a pending question with "no" and withdraws a grant already given
   *  — to the client those are one action, so they are one route. */
  http.post(url('/health-profile/access/:id/revoke'), ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const row = db.healthProfileAccess.find((a) => a.id === params.id && a.clientId === user.id);
    if (!row) return HttpResponse.json({ message: 'Not found.' }, { status: 404 });
    row.status = 'revoked';
    row.respondedAt = new Date().toISOString();
    return HttpResponse.json(row);
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
      createdAt: new Date().toISOString(),
      read: false,
    };
    const list = db.chatMessages.get(threadId) ?? [];
    list.push(message);
    db.chatMessages.set(threadId, list);
    const thread = db.chatThreads.find((t) => t.id === threadId);
    if (thread) {
      thread.lastMessage = message.body;
      thread.lastMessageAt = message.createdAt;
    }
    return HttpResponse.json(message);
  }),
];

// ---------------------------------------------------------------------------
// Wallet, server-quoted money actions, and notifications
// ---------------------------------------------------------------------------
const moneyQuotes = new Map<string, { userId: string; quote: { id: string; kind: 'withdrawal' | 'transfer' | 'cooperative-contribution'; amount: number; fee: number; recipientReceives: number; balanceAfter: number; currency: string; expiresAt: string; recipient?: string; local: unknown }; stepUpVerified: boolean }>();
const topUpQuotes = new Map<string, { userId: string; quote: WalletTopUpQuote }>();

/** installationId -> push token, scoped per user. */
const devices = new Map<string, string>();

const notificationPrefs = new Map<string, ReturnType<typeof defaultPreferences>>();

function defaultPreferences() {
  return {
    optional: { appointments: true, orders: true, chat: true, marketing: false },
    required: [
      { key: 'security', label: 'Security alerts' },
      { key: 'money', label: 'Money & wallet activity' },
    ],
    quietHours: { start: '22:00', end: '07:00', allowTimeSensitive: true },
  };
}

function preferencesFor(userId: string) {
  const existing = notificationPrefs.get(userId);
  if (existing) return existing;
  const created = defaultPreferences();
  notificationPrefs.set(userId, created);
  return created;
}

const walletHandlers: HttpHandler[] = [
  http.get(url('/wallet'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const wallet = db.wallets.get(user.id) ?? {
      available: 0,
      pending: 0,
      committed: 0,
      cooperativeSaved: 0,
      currency: 'USD',
      lastUpdatedAt: new Date().toISOString(),
      local: null,
    };

    // Converted at request time, from the rate in force now.
    return HttpResponse.json({
      ...wallet,
      local: db.localBlockFor(user.id, {
        available: wallet.available,
        pending: wallet.pending,
        cooperativeSaved: wallet.cooperativeSaved ?? 0,
      }),
    });
  }),

  http.get(url('/currencies'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    return HttpResponse.json({
      ...db.currencyIndex,
      mine: db.currencyFor(user.id)?.currency ?? null,
    });
  }),

  http.get(url('/wallet/ledger'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    return HttpResponse.json(paginate(db.ledgers.get(user.id) ?? []));
  }),

  // Funding quote. Separate from /wallet/quotes: money moves *in* through a
  // gateway, so there is no balance to check and no step-up to clear.
  http.post(url('/wallet/topups'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();

    const body = (await request.json()) as { amount?: number };
    const amount = Number(body.amount);
    const wallet = db.wallets.get(user.id);
    if (!wallet || !Number.isFinite(amount) || amount < 5) {
      return HttpResponse.json(
        {
          message: 'Enter an amount of at least $5 to fund your wallet.',
          code: 'invalid_amount',
          meta: { minimum: 5 },
        },
        { status: 422 },
      );
    }

    // Stands in for a gateway charge: 1.5% capped, quoted by the server so no
    // screen has to work one out.
    const fee = Math.min(Math.round(amount * 0.015 * 100) / 100, 20);
    const quote = {
      id: db.nextId('topup'),
      amount,
      fee,
      totalCharge: Math.round((amount + fee) * 100) / 100,
      walletCreditedWith: amount,
      balanceAfter: Math.round((wallet.available + amount) * 100) / 100,
      currency: wallet.currency,
      // 30 minutes, not 5: a bank transfer means leaving the app to pay.
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      // Only the charged figures convert; `balanceAfter` stays in USD.
      local: db.localBlockFor(user.id, {
        amount,
        fee,
        totalCharge: Math.round((amount + fee) * 100) / 100,
      }),
    };
    topUpQuotes.set(quote.id, { userId: user.id, quote });
    return HttpResponse.json(quote);
  }),

  http.post(url('/wallet/quotes'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const body = await request.json() as { kind?: 'withdrawal' | 'transfer' | 'cooperative-contribution'; amount?: number; recipient?: string };
    const wallet = db.wallets.get(user.id);
    const amount = Number(body.amount);
    if (!wallet || !body.kind || !Number.isFinite(amount) || amount <= 0 || amount > wallet.available) {
      return HttpResponse.json({ message: 'This amount is not available for an action.' }, { status: 422 });
    }
    if (body.kind === 'transfer' && !body.recipient?.trim()) {
      return HttpResponse.json({ message: 'Choose the member receiving this transfer.' }, { status: 422 });
    }
    if (body.kind === 'cooperative-contribution' && amount < 5) {
      return HttpResponse.json({ message: 'The minimum contribution is 5 USD.' }, { status: 422 });
    }
    const fee = body.kind === 'cooperative-contribution' ? 0 : Math.round(amount * 0.05 * 100) / 100;
    const quote = {
      id: db.nextId('quote'),
      kind: body.kind,
      amount,
      fee,
      recipientReceives: body.kind === 'cooperative-contribution' ? amount : Math.round((amount - fee) * 100) / 100,
      balanceAfter: Math.round((wallet.available - amount) * 100) / 100,
      currency: wallet.currency,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      recipient: body.recipient?.trim(),
      // The quote carries its own rate: settlement honours what was shown,
      // even if the rate moves before the action is executed.
      local: db.localBlockFor(user.id, {
        amount,
        fee,
        recipientReceives:
          body.kind === 'cooperative-contribution' ? amount : Math.round((amount - fee) * 100) / 100,
        balanceAfter: Math.round((wallet.available - amount) * 100) / 100,
      }),
    };
    moneyQuotes.set(quote.id, { userId: user.id, quote, stepUpVerified: false });
    return HttpResponse.json(quote);
  }),

  http.post(url('/wallet/quotes/:id/step-up/request'), ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const saved = moneyQuotes.get(String(params.id));
    if (!saved || saved.userId !== user.id) {
      return HttpResponse.json({ message: 'This quote is no longer available.' }, { status: 404 });
    }
    return HttpResponse.json({
      sent: true,
      destination: user.email,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });
  }),

  http.post(url('/wallet/quotes/:id/step-up'), async ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const saved = moneyQuotes.get(String(params.id));
    const body = await request.json() as { code?: string };
    if (!saved || saved.userId !== user.id) return HttpResponse.json({ message: 'This quote is no longer available.' }, { status: 404 });
    if (body.code !== db.otpCode) return HttpResponse.json({ message: 'That security code is not correct.' }, { status: 422 });
    saved.stepUpVerified = true;
    return HttpResponse.json({ ok: true });
  }),

  http.post(url('/wallet/actions'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const body = await request.json() as { quoteId?: string };
    const saved = moneyQuotes.get(String(body.quoteId));
    if (!saved || saved.userId !== user.id || !saved.stepUpVerified) {
      return HttpResponse.json({ message: 'Step-up verification is required before submitting.' }, { status: 422 });
    }
    const wallet = db.wallets.get(user.id);
    if (!wallet || saved.quote.amount > wallet.available) return HttpResponse.json({ message: 'Your available balance changed. Request a new quote.' }, { status: 422 });
    wallet.available = saved.quote.balanceAfter;
    if (saved.quote.kind === 'cooperative-contribution') {
      wallet.cooperativeSaved = (wallet.cooperativeSaved ?? 0) + saved.quote.amount;
    } else {
      wallet.pending += saved.quote.amount;
    }
    wallet.lastUpdatedAt = new Date().toISOString();
    const reference = `REF-${Math.floor(90000 + Math.random() * 9999)}`;
    const ledger = db.ledgers.get(user.id) ?? [];
    ledger.unshift({ id: db.nextId('txn'), reference, type: saved.quote.kind, amount: -saved.quote.amount, fee: saved.quote.fee, currency: saved.quote.currency, description: saved.quote.kind === 'withdrawal' ? 'Withdrawal processing' : saved.quote.kind === 'cooperative-contribution' ? 'Cooperative contribution' : `Transfer to ${saved.quote.recipient}`, createdAt: new Date().toISOString() });
    db.ledgers.set(user.id, ledger);
    moneyQuotes.delete(saved.quote.id);
    return HttpResponse.json({ reference, status: 'processing', quote: saved.quote });
  }),

  // Device push registration. Keyed on installationId so a rotated FCM token
  // replaces the row instead of adding one; the token is a delivery address,
  // never a credential.
  http.post(url('/devices/token'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();

    const body = (await request.json()) as { installationId?: string; token?: string };
    if (!body.installationId || !body.token) {
      return HttpResponse.json(
        { message: 'installationId and token are both required.' },
        { status: 422 },
      );
    }

    devices.set(`${user.id}:${body.installationId}`, body.token);
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(url('/devices/token/:installationId'), ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    devices.delete(`${user.id}:${String(params.installationId)}`);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(url('/notifications/prefs'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    return HttpResponse.json(preferencesFor(user.id));
  }),

  http.patch(url('/notifications/prefs'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();

    const body = (await request.json()) as {
      optional?: Record<string, boolean>;
      quietHours?: unknown;
    };
    const current = preferencesFor(user.id);

    // Only optional categories are patchable — security and money alerts are
    // not in `optional` at all, so they cannot be switched off from here.
    const next = {
      ...current,
      optional: { ...current.optional, ...(body.optional ?? {}) },
      quietHours: body.quietHours === undefined ? current.quietHours : (body.quietHours as never),
    };
    notificationPrefs.set(user.id, next);
    return HttpResponse.json(next);
  }),

  http.get(url('/notifications'), () => HttpResponse.json(db.notifications)),

  http.patch(url('/notifications/:id'), ({ params }) => {
    const n = db.notifications.find((x) => x.id === params.id);
    if (n) n.read = true;
    return HttpResponse.json({ ok: true });
  }),
];

// ---------------------------------------------------------------------------
// Gateway payments (Monnify). The device is never the authority here: an
// intent is priced and referenced by the server, and settlement is whatever
// the server says after it verifies with the gateway.
// ---------------------------------------------------------------------------
const paymentIntents = new Map<
  string,
  {
    userId: string;
    purpose: string;
    amount: number;
    currency: string;
    settled: boolean;
    /** Set on funding intents so settlement knows which quote to credit. */
    topUpQuoteId?: string;
  }
>();

const PLAN_PRICE_MINOR: Record<string, number> = { 'free-trial': 0, monthly: 1500, yearly: 20000 };

/**
 * Credits a wallet once its funding payment settles, and files the inbox row
 * a push would point at. Idempotent: the quote is consumed, so a second
 * confirm (a retry, or the polling GET) cannot credit the wallet twice.
 */
function creditSettledTopUp(userId: string, intent: { purpose: string; topUpQuoteId?: string }) {
  if (intent.purpose !== 'wallet-topup' || !intent.topUpQuoteId) return;

  const saved = topUpQuotes.get(intent.topUpQuoteId);
  if (!saved || saved.userId !== userId) return;
  topUpQuotes.delete(intent.topUpQuoteId);

  const wallet = db.wallets.get(userId);
  if (!wallet) return;

  const now = new Date().toISOString();
  wallet.available = Math.round((wallet.available + saved.quote.walletCreditedWith) * 100) / 100;
  wallet.lastUpdatedAt = now;

  const ledger = db.ledgers.get(userId) ?? [];
  ledger.unshift({
    id: db.nextId('txn'),
    reference: `REF-${Math.floor(90000 + Math.random() * 9999)}`,
    type: 'deposit',
    amount: saved.quote.walletCreditedWith,
    fee: saved.quote.fee,
    currency: saved.quote.currency,
    description: 'Wallet funding',
    createdAt: now,
  });
  db.ledgers.set(userId, ledger);

  db.notifications.unshift({
    id: `notif-topup-${Date.now()}`,
    category: 'wallet',
    title: 'Wallet funded',
    body: 'Your wallet top-up has been confirmed and your balance is updated.',
    read: false,
    actionLabel: 'View wallet',
    actionRoute: '/tabs/wallet',
    createdAt: now,
  });
}

const paymentHandlers: HttpHandler[] = [
  http.post(url('/payments/intents'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();

    const body = (await request.json()) as {
      purpose?: string;
      subject?: string;
      expectedAmount?: number;
      expectedCurrency?: string;
    };

    // The server prices the subject; `expectedAmount` only detects a stale quote.
    // A top-up is priced from the quote the customer already reviewed, never
    // from a figure the app supplied.
    const topUp = body.purpose === 'wallet-topup' ? topUpQuotes.get(body.subject ?? '') : undefined;
    if (body.purpose === 'wallet-topup' && (!topUp || topUp.userId !== user.id)) {
      return HttpResponse.json(
        { message: 'That top-up quote has expired. Please review it again.', code: 'stale_quote' },
        { status: 422 },
      );
    }

    const baseCurrency = topUp?.quote.currency ?? db.wallets.get(user.id)?.currency ?? 'USD';
    const baseAmount = topUp
      ? topUp.quote.totalCharge
      : body.purpose === 'therapist-plan'
        ? (PLAN_PRICE_MINOR[body.subject ?? ''] ?? 0) / 100
        : 0;

    if (!body.purpose || !body.subject || baseAmount <= 0) {
      return HttpResponse.json(
        { message: 'There is nothing to pay for on that request.', code: 'unpayable_subject' },
        { status: 422 },
      );
    }

    // Compared against the base figure: the app only ever sends USD.
    if (typeof body.expectedAmount === 'number' && body.expectedAmount !== baseAmount) {
      return HttpResponse.json(
        { message: 'That price has changed. Please review it again.', code: 'stale_quote' },
        { status: 422 },
      );
    }

    // What the sheet actually charges. A payer in a supported country is
    // charged in their own currency; everyone else stays on the base figure.
    const payerCurrency = db.currencyFor(user.id);
    const chargeCurrency = payerCurrency?.currency ?? baseCurrency;
    const chargeAmount = payerCurrency?.rate
      ? Math.round(baseAmount * payerCurrency.rate * 100) / 100
      : baseAmount;

    const reference = `CCPAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    paymentIntents.set(reference, {
      userId: user.id,
      purpose: body.purpose,
      amount: chargeAmount,
      currency: chargeCurrency,
      settled: false,
      topUpQuoteId: topUp?.quote.id,
    });

    return HttpResponse.json({
      reference,
      amount: chargeAmount,
      currency: chargeCurrency,
      description: `CruxCare ${body.purpose} (${body.subject})`,
      customerName: `${user.firstName} ${user.lastName}`.trim(),
      customerEmail: user.email,
      // Null exercises the app's build-time fallback. A real API returns the
      // merchant credentials here so keys rotate without an app release.
      gateway: null,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
  }),

  http.post(url('/payments/intents/:reference/confirm'), ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();

    const intent = paymentIntents.get(String(params.reference));
    if (!intent || intent.userId !== user.id) {
      return HttpResponse.json({ message: 'That payment could not be found.' }, { status: 404 });
    }

    // A gateway confirmation is asynchronous in reality; the mock stays
    // pending once so no screen can be written against instant settlement.
    const status = intent.settled ? 'settled' : 'pending';
    intent.settled = true;
    if (status === 'settled') creditSettledTopUp(user.id, intent);

    return HttpResponse.json({
      reference: String(params.reference),
      status,
      message:
        status === 'settled'
          ? 'Payment confirmed.'
          : 'Your payment is being confirmed. This usually takes a few moments.',
      amountPaid: status === 'settled' ? intent.amount : null,
      currency: intent.currency,
      settledAt: status === 'settled' ? new Date().toISOString() : null,
    });
  }),

  http.get(url('/payments/intents/:reference'), ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();

    const intent = paymentIntents.get(String(params.reference));
    if (!intent || intent.userId !== user.id) {
      return HttpResponse.json({ message: 'That payment could not be found.' }, { status: 404 });
    }

    if (intent.settled) creditSettledTopUp(user.id, intent);

    return HttpResponse.json({
      reference: String(params.reference),
      status: intent.settled ? 'settled' : 'pending',
      message: intent.settled ? 'Payment confirmed.' : 'Your payment is being confirmed.',
      amountPaid: intent.settled ? intent.amount : null,
      currency: intent.currency,
      settledAt: intent.settled ? new Date().toISOString() : null,
    });
  }),
];

export const handlers: HttpHandler[] = [
  ...authHandlers,
  ...marketplaceHandlers,
  ...careHandlers,
  ...walletHandlers,
  ...paymentHandlers,
];
