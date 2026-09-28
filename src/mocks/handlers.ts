import { http, HttpResponse, type HttpHandler } from 'msw';
import * as db from './db';
import type { RegisterPayload } from '@/api/auth.api';
import type { CreateAppointmentPayload } from '@/api/appointments.api';
import type { ProductQuery } from '@/api/products.api';
import type { CartItem, CheckoutQuote, Order } from '@/types/marketplace';
import type {
  CareRequest,
  CaseFile,
  CaseProgressReport,
  HealthProfile,
  HealthProfileAccess,
  TherapistCareRequest,
  TreatmentExtension,
  WorkingDay,
} from '@/types/care';
import type { WalletTopUpQuote } from '@/types/wallet';
import type { TherapistPlanTier, User } from '@/types/user';
import { fullName, genderOptions } from '@/types/user';
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

/** The fixture's fixed code, so a walkthrough does not need a mailbox. */
const MOCK_OTP = '12345';

/** `am***@example.com` — enough to recognise, not enough to read out. */
function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
}

function maskPhone(phone: string): string {
  return phone.length <= 4 ? phone : `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}`;
}

function paginate<T>(items: T[]) {
  return { data: items, meta: { nextCursor: null, hasMore: false } };
}

/**
 * The client answers on their own screen; the therapist reads the answer off
 * the case file. Two records of one decision, so they are written together —
 * a grant the case file never heard about is the bug this prevents.
 *
 * Returns the case file it wrote to, so the caller can name it: the
 * therapist's notification carries the *case file's* id, not the consent
 * row's (§4.2), which is the id their app has a screen for.
 */
function syncCaseFileAccess(row: HealthProfileAccess): CaseFile | undefined {
  const caseFile = db.caseFiles.find(
    (c) => c.clientId === row.clientId && c.therapistId === row.therapistId,
  );
  if (!caseFile) return undefined;
  caseFile.healthProfileAccess = {
    status: row.status,
    reason: row.reason,
    requestedAt: row.requestedAt,
    respondedAt: row.respondedAt,
  };
  return caseFile;
}

/**
 * The therapist is told what the client decided (§4.2).
 *
 * A withdrawal notifies as loudly as a grant, on purpose. The case file stops
 * showing the profile either way, but silence there reads as a loading fault —
 * a therapist re-opening a panel that has quietly stopped working is exactly
 * the case this closes. It says the client withdrew and never implies they did
 * something wrong.
 *
 * Nothing is sent when there is no case file: without one there is no screen
 * for the tap to land on, and no live care relationship to report about.
 */
function notifyTherapistOfAccessAnswer(
  row: HealthProfileAccess,
  caseFile: CaseFile | undefined,
  clientName: string,
) {
  if (!caseFile) return;
  const granted = row.status === 'granted';
  db.notifications.unshift({
    id: `notif-hpa-answer-${row.id}-${Date.now()}`,
    // Neither security nor money, so it respects the category switch and quiet
    // hours like the rest of the course of treatment.
    category: 'cases',
    title: granted ? 'Health profile shared with you' : 'Health profile no longer shared',
    body: granted
      ? `${clientName} has allowed you to read their health profile.`
      : `${clientName} has withdrawn access to their health profile.`,
    read: false,
    actionLabel: 'Open case file',
    actionRoute: `/therapist/clients/${caseFile.id}`,
    createdAt: row.respondedAt ?? new Date().toISOString(),
  });
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

  http.post(url('/auth/logout'), async ({ request }) => {
    const auth = request.headers.get('Authorization')?.replace('Bearer ', '');
    const body = (await request.json().catch(() => ({}))) as { allDevices?: boolean };
    const userId = auth ? tokens.get(auth) : undefined;

    // `allDevices` takes every token on the account, not only the caller's.
    if (body.allDevices && userId) {
      for (const [token, owner] of [...tokens.entries()]) {
        if (owner === userId) tokens.delete(token);
      }
    } else if (auth) {
      tokens.delete(auth);
    }

    return new HttpResponse(null, { status: 204 });
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
        caseId: db.nextId('case-record'),
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

/** One wording for both screens that show it, as the live API does. */
const PRODUCT_DISCLAIMER =
  'These products are recommended by your therapist and are not a substitute for medical advice. Check with your therapist before combining them with other medication.';

function caseNotFound() {
  return HttpResponse.json(
    { message: 'That case could not be found.', code: 'case_not_found' },
    { status: 404 },
  );
}

/** Accept and remove both answer with the recomputed bill, so neither needs a
 *  follow-up fetch — mirrored here so the app's cache behaves the same. */
const MINIMUM_PLAN_DAYS = 30;

/* ---- Earnings and the four purses ------------------------------------ */

/** Carved out of each earning, never added on top. */
const LOYALTY_PERCENT = 10;
/** The loyalty purse does not pay out below this. Measured against the
 *  balance, not the request. */
const LOYALTY_MINIMUM = 100;

/** Requests Tuesday to Friday; the payout run is Monday. Days, not hours, so
 *  the two acts stay distinguishable. */
const REQUEST_DAYS = [2, 3, 4, 5];
const PAYOUT_DAY = 1;

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function nextWeekday(from: Date, weekday: number) {
  const at = startOfDay(from);
  // Always strictly ahead: "next Monday" on a Monday means the one coming.
  do {
    at.setDate(at.getDate() + 1);
  } while (at.getDay() !== weekday);
  return at;
}

function withdrawalWindowNow(now = new Date()) {
  const open = REQUEST_DAYS.includes(now.getDay());
  const opensAt = open ? null : nextWeekday(now, REQUEST_DAYS[0]).toISOString();
  const closesAt = open ? endOfWindow(now).toISOString() : null;
  return {
    open,
    opensAt,
    closesAt,
    nextPayoutAt: nextWeekday(now, PAYOUT_DAY).toISOString(),
    requestDays: 'Tuesday to Friday',
    payoutDay: 'Monday',
  };
}

function endOfWindow(now: Date) {
  const at = startOfDay(now);
  while (at.getDay() !== REQUEST_DAYS[REQUEST_DAYS.length - 1]) at.setDate(at.getDate() + 1);
  at.setHours(23, 59, 59, 999);
  return at;
}

/**
 * The four purses.
 *
 * `available`/`pending` at the top level are the e-wallet and stay that way —
 * this block is additive. Cash carries the therapist's cleared and clearing
 * earnings; loyalty carries the reserve and is shut until it reaches its floor.
 */
function pursesFor(userId: string, wallet: { available: number; pending: number; currency: string }) {
  const rows = db.earningsFor(userId);
  const cashCleared = rows.filter((r) => r.status === 'due').reduce((t, r) => t + r.cashMinor, 0);
  const cashClearing = rows.filter((r) => r.status === 'accrued').reduce((t, r) => t + r.cashMinor, 0);
  const loyalty = rows.filter((r) => r.status === 'due').reduce((t, r) => t + r.loyaltyMinor, 0);
  const currency = wallet.currency;

  return {
    cash: {
      key: 0,
      slug: 'cash',
      name: 'Cash',
      available: cashCleared / 100,
      pending: cashClearing / 100,
      currency,
      capabilities: { withdraw: true, spend: false, transfer: false },
      minimumWithdrawal: null,
      minimumReached: true,
      local: null,
    },
    ewallet: {
      key: 1,
      slug: 'ewallet',
      name: 'E-wallet',
      available: wallet.available,
      pending: wallet.pending,
      currency,
      // Money funded through a gateway leaving through a bank payout is a
      // refund path with different rules, not a withdrawal.
      capabilities: { withdraw: false, spend: true, transfer: true },
      minimumWithdrawal: null,
      minimumReached: true,
      local: null,
    },
    reward: {
      key: 2,
      slug: 'reward',
      name: 'Reward',
      available: 0,
      pending: 0,
      currency,
      capabilities: { withdraw: false, spend: true, transfer: false },
      minimumWithdrawal: null,
      minimumReached: true,
      local: null,
    },
    loyalty: {
      key: 3,
      slug: 'loyalty',
      name: 'Loyalty',
      available: loyalty / 100,
      pending: 0,
      currency,
      capabilities: { withdraw: true, spend: false, transfer: false },
      minimumWithdrawal: LOYALTY_MINIMUM,
      minimumReached: loyalty / 100 >= LOYALTY_MINIMUM,
      local: null,
    },
  };
}

/**
 * What has been settled on each case, by component.
 *
 * Kept here rather than on `CaseFile` because it is mock bookkeeping, not part
 * of the contract — and because a single "subscription is active" flag cannot
 * represent a 70% deposit, which is the state the whole schedule exists for.
 */
const casePaid = new Map<string, { treatmentMinor: number; productsMinor: number }>();

function paidFor(caseId: string) {
  return casePaid.get(caseId) ?? { treatmentMinor: 0, productsMinor: 0 };
}

/** Strictly longer than the minimum: a 30-day plan is paid in full, a 31-day
 *  one may be split. */
function planDurationDays(caseFile: CaseFile) {
  const plan = caseFile.treatmentPlan;
  if (!plan?.startDate || !plan?.endDate) return 0;
  const from = new Date(plan.startDate).getTime();
  const to = new Date(plan.endDate).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

function midpointOf(caseFile: CaseFile) {
  const plan = caseFile.treatmentPlan;
  if (!plan?.startDate || !plan?.endDate) return null;
  const from = new Date(plan.startDate).getTime();
  const to = new Date(plan.endDate).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return new Date(from + (to - from) / 2).toISOString();
}

/**
 * Moves the window, once there is nothing owed for it.
 *
 * Added visits join the subscription already running rather than opening a
 * second one beside it, so `visitsUsed` keeps counting the sessions the client
 * has actually taken.
 */
function applyExtension(caseFile: CaseFile, extension: TreatmentExtension) {
  const plan = caseFile.treatmentPlan;
  if (plan) caseFile.treatmentPlan = { ...plan, endDate: extension.newEndDate };
  caseFile.treatmentEndDate = extension.newEndDate;

  if (caseFile.subscription) {
    const subscription = caseFile.subscription;
    const visitsTotal = subscription.visitsTotal + extension.addedVisits;
    caseFile.subscription = {
      ...subscription,
      visitsTotal,
      visitsRemaining: visitsTotal - subscription.visitsUsed,
      endsAt: extension.newEndDate,
    };
  }

  extension.status = 'applied';
  extension.appliedAt = new Date().toISOString();
}

function billFor(caseFile: CaseFile) {
  const accepted = caseFile.recommendations.filter((r) => r.status === 'accepted');
  const productsMinor = accepted.reduce((sum, r) => sum + r.unitPriceMinor * r.quantity, 0);
  // A cadence proposed without a priced plan stores no treatment figure, so
  // the bill genuinely has none — the case the app renders as unpriced.
  const treatmentMinor = caseFile.subscription?.amountMinor ?? 0;
  const settled = paidFor(caseFile.caseId);
  const treatmentPaid = Math.min(settled.treatmentMinor, treatmentMinor);
  const productsPaid = Math.min(settled.productsMinor, productsMinor);
  const paidMinor = treatmentPaid + productsPaid;
  const totalMinor = treatmentMinor + productsMinor;
  const treatmentOutstanding = treatmentMinor - treatmentPaid;

  // Only the plan splits, only 70/30, and only when it runs strictly longer
  // than the minimum. The two parts always sum to the plan exactly, whichever
  // way the rounding fell — which is why the balance is a subtraction.
  const days = planDurationDays(caseFile);
  const splittable = days > MINIMUM_PLAN_DAYS && treatmentMinor > 0;
  const depositMinor = Math.round(treatmentMinor * 0.7);
  const balanceMinor = treatmentMinor - depositMinor;
  const depositPaid = Math.min(treatmentPaid, depositMinor);

  const schedule = !treatmentMinor
    ? []
    : splittable
      ? [
          {
            key: 'treatment-deposit',
            label: 'Before treatment starts',
            percent: 70,
            amountMinor: depositMinor,
            paidMinor: depositPaid,
            outstandingMinor: depositMinor - depositPaid,
            status: depositMinor - depositPaid === 0 ? 'paid' : 'due',
            dueAt: null,
          },
          {
            key: 'treatment-balance',
            label: 'Midway through treatment',
            percent: 30,
            amountMinor: balanceMinor,
            paidMinor: Math.max(0, treatmentPaid - depositMinor),
            outstandingMinor: balanceMinor - Math.max(0, treatmentPaid - depositMinor),
            status:
              balanceMinor - Math.max(0, treatmentPaid - depositMinor) === 0 ? 'paid' : 'upcoming',
            dueAt: midpointOf(caseFile),
          },
        ]
      : [
          {
            key: 'treatment',
            label: 'Your treatment plan',
            percent: 100,
            amountMinor: treatmentMinor,
            paidMinor: treatmentPaid,
            outstandingMinor: treatmentOutstanding,
            status: treatmentOutstanding === 0 ? 'paid' : 'due',
            dueAt: null,
          },
        ];

  /**
   * Spread what has been paid for products across the accepted lines, oldest
   * first, so each line carries its own settled figure.
   *
   * The ledger only tracks one products total for the case, but "may this line
   * be removed?" is a question about a line: a therapist must not be able to
   * delete something the client has already paid for, and a case-wide total
   * cannot answer that. Allocating in order is arbitrary but consistent, and
   * it is the server's answer the app is meant to be reading here.
   */
  let productsLeftToAllocate = productsPaid;
  for (const line of accepted) {
    const lineMinor = line.unitPriceMinor * line.quantity;
    const linePaid = Math.min(lineMinor, productsLeftToAllocate);
    productsLeftToAllocate -= linePaid;
    line.paidMinor = linePaid;
    // Removing a paid line would be a refund, not a delete.
    line.removable = linePaid === 0;
  }

  /**
   * What the client owes today: the instalment that is due now, plus every
   * unpaid product. Computed here rather than on the device for the same
   * reason the schedule is — deciding which step is "due" is the server's job.
   */
  const dueStep = schedule.find((s) => s.status === 'due' || s.status === 'overdue');
  const dueNowRaw = (dueStep?.outstandingMinor ?? 0) + (productsMinor - productsPaid);
  // Null rather than zero when nothing is due, so the app offers no button at
  // all rather than one that would charge nothing.
  const dueNowWithProductsMinor = dueNowRaw > 0 ? dueNowRaw : null;

  /**
   * Extra visits bought after the course started and not yet paid for. Its own
   * component rather than folded into treatment: the 70/30 schedule is a
   * percentage *of the treatment component*, so adding a top-up to it would
   * re-price a deposit the client has already paid.
   */
  const extensionsOutstandingMinor = (caseFile.treatmentExtensions ?? [])
    .filter((e) => e.status === 'awaiting-payment')
    .reduce((sum, e) => sum + e.amountMinor, 0);

  return HttpResponse.json({
    data: {
      caseId: caseFile.caseId,
      currency: 'USD',
      treatmentTotal: treatmentMinor / 100,
      treatmentTotalMinor: treatmentMinor,
      productsTotal: productsMinor / 100,
      productsTotalMinor: productsMinor,
      total: totalMinor / 100,
      totalMinor,
      paid: paidMinor / 100,
      paidMinor,
      outstanding: (totalMinor - paidMinor) / 100,
      outstandingMinor: totalMinor - paidMinor,
      treatmentPaidMinor: treatmentPaid,
      treatmentOutstandingMinor: treatmentOutstanding,
      productsOutstandingMinor: productsMinor - productsPaid,
      products: accepted,
      payment: {
        instalmentsAvailable: splittable,
        instalmentsUnavailableReason: splittable ? null : 'plan_shorter_than_minimum',
        minimumDurationDays: MINIMUM_PLAN_DAYS,
        planDurationDays: days,
        // Goods, not care over months. Never true.
        productsPayableInInstalments: false,
        productsOutstandingMinor: productsMinor - productsPaid,
        treatmentDueBeforeStartMinor: splittable ? depositMinor : treatmentMinor,
        dueNowWithProductsMinor,
        extensionsOutstandingMinor,
        schedule,
      },
    },
    meta: { productDisclaimer: PRODUCT_DISCLAIMER },
  });
}

const careHandlers: HttpHandler[] = [
  http.get(url('/therapists'), ({ request }) => {
    // Filtered server-side. A therapist who has recorded no gender matches no
    // filter at all, which is why a filtered directory is always shorter.
    const wanted = new URL(request.url).searchParams.get('gender');
    if (!wanted) return HttpResponse.json(paginate(db.therapists));
    if (!['female', 'male', 'non-binary', 'prefer-not-to-say'].includes(wanted)) {
      return HttpResponse.json(
        { message: 'That is not a gender we filter by.', code: 'invalid_gender' },
        { status: 422 },
      );
    }
    return HttpResponse.json(paginate(db.therapists.filter((t) => t.gender === wanted)));
  }),

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
      ...paginate(db.therapistRotas[profile.id] ?? []),
      meta: { nextCursor: null, hasMore: false, timezone: 'Africa/Lagos' },
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

    return HttpResponse.json({
      ...paginate(sorted),
      meta: { nextCursor: null, hasMore: false, timezone: 'Africa/Lagos' },
    });
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

  // A client holds one therapist at a time. An unanswered request ties them
  // up as surely as an accepted one.
  http.get(url('/care/engagement'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const held = db
      .careRequestsFor(user.id)
      .find((r) => r.status === 'accepted' || r.status === 'submitted' || r.status === 'in-review');
    if (!held) {
      return HttpResponse.json({ data: null, meta: { mayChooseAnotherTherapist: true } });
    }
    const caseFile = db.caseFiles[0];
    // Anything recorded on the case is something to unpick, so ending it needs
    // a person rather than a tap.
    const hasHistory =
      !!caseFile?.diagnosis ||
      !!caseFile?.notes.length ||
      !!caseFile?.recommendations.length ||
      !!caseFile?.treatmentPlan?.cadence ||
      !!caseFile?.subscription;
    return HttpResponse.json({
      data: {
        caseId: caseFile?.caseId ?? 'case-record-1',
        therapistId: held.therapistId ?? 'therapist-1',
        therapistName: held.therapistName ?? 'Your therapist',
        canDiscontinue: !hasHistory,
      },
      meta: { mayChooseAnotherTherapist: false },
    });
  }),

  http.post(url('/care/requests/:id/discontinue'), ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const found = db.careRequestsFor(user.id).find((r) => r.id === params.id);
    if (!found) return HttpResponse.json({ message: 'Not found.' }, { status: 404 });

    const caseFile = db.caseFiles[0];
    const hasHistory =
      !!caseFile?.diagnosis ||
      !!caseFile?.notes.length ||
      !!caseFile?.recommendations.length ||
      !!caseFile?.treatmentPlan?.cadence ||
      !!caseFile?.subscription;
    if (hasHistory) {
      return HttpResponse.json(
        {
          message: 'Please contact support to end this course of care.',
          code: 'discontinue_needs_support',
          meta: {
            support: {
              email: 'support@cruxcare.example',
              phone: '+234 800 000 0000',
              hours: 'Mon to Fri, 9am to 5pm WAT',
            },
          },
        },
        { status: 409 },
      );
    }
    found.status = 'closed';
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

  // -------------------------------------------------------------------------
  // Video sessions and recording consent (backend note §12)
  // -------------------------------------------------------------------------

  /**
   * The room is named by the server, never by the client, and the token is
   * short-lived. Asking again returns the same room with a fresh token, so a
   * dropped connection rejoins the call rather than opening a second one.
   */
  http.post(url('/appointments/:id/video/token'), ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();

    const appt = db.appointments.find((a) => a.id === params.id);
    // A 404 for a stranger and for a missing appointment alike: telling them
    // apart would confirm that someone else's session exists.
    if (!appt || (appt.clientId !== user.id && appt.therapistId !== user.id)) {
      return HttpResponse.json(
        { message: 'That session is not available.', code: 'appointment_not_found' },
        { status: 404 },
      );
    }

    if (appt.type !== 'video') {
      return HttpResponse.json(
        { message: 'This appointment is not a video visit.', code: 'session_not_video', meta: { type: appt.type } },
        { status: 422 },
      );
    }

    const slot = new Date(appt.slot).getTime();
    const opensAt = slot - 15 * 60 * 1000;
    const closesAt = slot + 60 * 60 * 1000;
    const now = Date.now();
    if (now < opensAt || now > closesAt) {
      return HttpResponse.json(
        {
          message: 'This session is not open yet.',
          code: 'outside_session_window',
          meta: { opensAt: new Date(opensAt).toISOString(), closesAt: new Date(closesAt).toISOString() },
        },
        { status: 422 },
      );
    }

    const roomId = `cc-${appt.id}`;
    return HttpResponse.json({
      provider: 'daily',
      roomId,
      token: `mock-token-${Date.now()}`,
      expiresAt: new Date(now + 15 * 60 * 1000).toISOString(),
      role: appt.therapistId === user.id ? 'host' : 'guest',
      url: `https://cruxcare.daily.co/${roomId}`,
    });
  }),

  /** Ejects everyone. The therapist's control, not a participant leaving. */
  http.post(url('/appointments/:id/video/end'), ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();

    const appt = db.appointments.find((a) => a.id === params.id);
    if (!appt) return HttpResponse.json({ message: 'That session is not available.', code: 'appointment_not_found' }, { status: 404 });
    if (appt.therapistId !== user.id) {
      return HttpResponse.json(
        { message: 'Only the therapist can end this session.', code: 'not_session_host' },
        { status: 403 },
      );
    }

    recordingConsent.delete(`${appt.id}:${appt.clientId}`);
    recordingConsent.delete(`${appt.id}:${appt.therapistId}`);
    return new HttpResponse(null, { status: 204 });
  }),

  http.get(url('/appointments/:id/video/consent'), ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const appt = db.appointments.find((a) => a.id === params.id);
    if (!appt || (appt.clientId !== user.id && appt.therapistId !== user.id)) {
      return HttpResponse.json({ message: 'That session is not available.', code: 'appointment_not_found' }, { status: 404 });
    }
    return HttpResponse.json(consentFor(appt, user.id));
  }),

  http.put(url('/appointments/:id/video/consent'), async ({ request, params }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const appt = db.appointments.find((a) => a.id === params.id);
    if (!appt || (appt.clientId !== user.id && appt.therapistId !== user.id)) {
      return HttpResponse.json({ message: 'That session is not available.', code: 'appointment_not_found' }, { status: 404 });
    }

    const { granted } = (await request.json()) as { granted: boolean };
    recordingConsent.set(`${appt.id}:${user.id}`, granted === true);
    return HttpResponse.json(consentFor(appt, user.id));
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
  /**
   * Changing a contact. The code goes to the one being replaced, which is the
   * whole point: a stolen session cannot move the account onto a channel the
   * thief controls.
   */
  http.post(url('/me/email/change'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();

    const { email } = (await request.json()) as { email: string };
    const wanted = (email ?? '').trim().toLowerCase();

    if (wanted === user.email.toLowerCase()) {
      return HttpResponse.json(
        { message: 'That is already your email address.', code: 'email_unchanged' },
        { status: 422 },
      );
    }

    // Same answer whether or not it is taken: whether an address is registered
    // is not something a caller gets to probe.
    if (db.users.some((u) => u.email.toLowerCase() === wanted && u.id !== user.id)) {
      return HttpResponse.json(
        { message: 'That email address cannot be used.', code: 'email_unavailable' },
        { status: 422 },
      );
    }

    return HttpResponse.json({ channel: 'email', destination: maskEmail(user.email) });
  }),

  http.post(url('/me/email/verify'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();

    const { email, code } = (await request.json()) as { email: string; code: string };
    if (code !== MOCK_OTP) {
      return HttpResponse.json(
        { message: 'That code is not valid.', code: 'otp_invalid' },
        { status: 422 },
      );
    }

    user.email = email.trim().toLowerCase();
    return HttpResponse.json(db.toPublicUser(user));
  }),

  http.post(url('/me/phone/change'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();

    const { channel } = (await request.json()) as { phone: string; channel?: string };
    return HttpResponse.json({
      channel: channel ?? 'sms',
      destination: maskPhone(user.phone),
    });
  }),

  http.post(url('/me/phone/verify'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();

    const { phone, code } = (await request.json()) as { phone: string; code: string };
    if (code !== MOCK_OTP) {
      return HttpResponse.json(
        { message: 'That code is not valid.', code: 'otp_invalid' },
        { status: 422 },
      );
    }

    user.phone = phone;
    return HttpResponse.json(db.toPublicUser(user));
  }),

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
    notifyTherapistOfAccessAnswer(row, syncCaseFileAccess(row), fullName(user) || 'Your client');
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
    notifyTherapistOfAccessAnswer(row, syncCaseFileAccess(row), fullName(user) || 'Your client');
    return HttpResponse.json(row);
  }),

  /** The therapist asks. Re-asking reopens the same row rather than raising a
   *  second one the client would have to refuse twice (backend note §15.3). */
  http.post(url('/clients/:clientId/health-profile/access'), async ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const clientId = String(params.clientId);

    const caseFile = db.caseFiles.find(
      (c) => c.clientId === clientId && c.therapistId === user.id,
    );
    if (!caseFile) {
      return HttpResponse.json({ message: 'Client not found.', code: 'client_not_found' }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const reason = body.reason?.trim() ? body.reason.trim().slice(0, 240) : null;

    const existing = db.healthProfileAccess.find(
      (a) => a.clientId === clientId && a.therapistId === user.id,
    );
    if (existing?.status === 'pending') {
      return HttpResponse.json(
        {
          message: 'You have already asked.',
          code: 'access_already_requested',
          meta: { requestedAt: existing.requestedAt },
        },
        { status: 409 },
      );
    }
    if (existing?.status === 'granted') {
      return HttpResponse.json(
        { message: 'Access is already granted.', code: 'access_already_granted' },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    const row = existing ?? {
      id: `hpa-${db.healthProfileAccess.length + 1}`,
      therapistId: user.id,
      therapistName: fullName(user) || null,
      clientId,
      status: 'pending' as const,
      reason,
      requestedAt: now,
      respondedAt: null,
    };
    row.status = 'pending';
    row.reason = reason;
    row.requestedAt = now;
    row.respondedAt = null;
    if (!existing) db.healthProfileAccess.push(row);

    caseFile.healthProfileAccess = {
      status: 'pending',
      reason,
      requestedAt: now,
      respondedAt: null,
    };

    /**
     * The client is told. Without this the ask landed in a list they had no
     * reason to open — the row existed and the answer screen existed, and the
     * question still reached nobody.
     *
     * `cases` per §4.2, not `system`: this is neither security nor money, so it
     * respects the category switch and quiet hours like the rest of the course
     * of treatment. The therapist's name stays in the row on purpose — the
     * contract strips it from the *lock screen* only, and by the time this is
     * read the client has authenticated (§14.5).
     *
     * A re-ask reopens the same access row but raises a fresh notification:
     * the second ask is news even when the row is not.
     */
    db.notifications.unshift({
      id: `notif-hpa-${row.id}-${Date.now()}`,
      category: 'cases',
      title: 'A therapist asked to read your health profile',
      body: reason
        ? `${row.therapistName ?? 'Your therapist'}: “${reason}”`
        : `${row.therapistName ?? 'Your therapist'} cannot read it until you allow it.`,
      read: false,
      actionLabel: 'Review request',
      actionRoute: '/profile/health-profile-access',
      createdAt: now,
    });

    return HttpResponse.json(row, { status: 201 });
  }),

  /** Every refusal names itself, so the panel can tell a wait from a no from a
   *  lapsed plan. Only a plan lapse and an untreated client answer 404. */
  http.get(url('/clients/:clientId/health-profile'), ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const clientId = String(params.clientId);

    const caseFile = db.caseFiles.find(
      (c) => c.clientId === clientId && c.therapistId === user.id,
    );
    // Which clients a therapist does *not* treat is not probeable.
    if (!caseFile) {
      return HttpResponse.json(
        { message: 'Health profile not found.', code: 'health_profile_not_found' },
        { status: 404 },
      );
    }

    const status = caseFile.healthProfileAccess?.status ?? 'not-requested';
    if (status !== 'granted') {
      const code =
        status === 'pending'
          ? 'access_pending'
          : status === 'revoked'
            ? 'access_revoked'
            : 'access_not_requested';
      return HttpResponse.json({ message: 'Not shared.', code }, { status: 403 });
    }

    const profile = db.healthProfiles.get(clientId);
    if (!profile) {
      return HttpResponse.json(
        { message: 'Health profile not found.', code: 'health_profile_not_found' },
        { status: 404 },
      );
    }
    return HttpResponse.json(profile);
  }),

  // --- The case as a course of treatment -----------------------------------

  http.get(url('/care/plans'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const caseId = new URL(request.url).searchParams.get('caseId');
    // A bespoke plan is scoped to one case and sits in the same catalogue as
    // the presets, so it reaches the client through the ordinary card and the
    // ordinary payment rail.
    const bespoke = db.carePlanOptions.filter((p) => p.bespoke && p.id.endsWith(`-${caseId}`));
    const presets = db.carePlanOptions.filter((p) => !p.bespoke);
    /**
     * Which one they picked, so the client screen can show the answer instead
     * of asking the question again.
     *
     * Read off the *case file's* plan rather than the subscription: choosing is
     * separate from paying, and between those two moments there is a decision
     * the screen has to show with no subscription in existence yet. Resolving
     * it from the subscription left exactly the gap this field closes, one step
     * earlier (backend, 15 Sept).
     */
    const chosenPlanId =
      db.caseFiles.find((c) => c.caseId === caseId)?.treatmentPlan?.planId ??
      db.careSubscriptions.find((s) => s.caseId === caseId)?.planId ??
      null;
    const withChoice = [...bespoke, ...presets].map((p) => ({
      ...p,
      chosen: !!chosenPlanId && p.id === chosenPlanId,
    }));
    return HttpResponse.json(paginate(withChoice));
  }),

  http.get(url('/care/subscriptions/current'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const caseId = new URL(request.url).searchParams.get('caseId');
    const found = db.careSubscriptions.find((s) => s.caseId === caseId);
    // Null inside the data wrapper is the answer for "no plan yet" — an
    // ordinary state, so never a 404.
    return HttpResponse.json({ data: found ?? null });
  }),

  http.post(url('/care/subscriptions'), async ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const body = (await request.json()) as {
      caseId: string;
      planId: string;
      paymentToken?: string;
      expectedAmountMinor: number;
    };

    if (!body.paymentToken) {
      // The device seeing a successful sheet is a hint; the server verifying
      // the reference with the gateway is the fact.
      return HttpResponse.json(
        { message: 'That payment has not settled yet.', code: 'payment_not_settled' },
        { status: 409 },
      );
    }

    const option = db.carePlanOptions.find((p) => p.id === body.planId);
    if (!option) {
      return HttpResponse.json({ message: 'That plan is no longer offered.', code: 'plan_not_found' }, { status: 404 });
    }
    // The price the client saw has to be the price they are charged.
    if (option.amountMinor !== body.expectedAmountMinor) {
      return HttpResponse.json(
        {
          message: 'That price has changed. Check the plan and try again.',
          code: 'plan_price_changed',
          meta: { amountMinor: option.amountMinor, currency: option.currency },
        },
        { status: 409 },
      );
    }

    const caseFile = db.caseFiles.find((c) => c.id === body.caseId);
    const now = new Date();
    const ends = new Date(now.getTime() + option.durationDays * 86400000);
    const subscription = {
      id: 'sub-' + (db.careSubscriptions.length + 1),
      planId: option.id,
      caseId: body.caseId,
      cadence: option.cadence,
      status: 'active' as const,
      visitsTotal: option.visits,
      visitsUsed: 0,
      visitsRemaining: option.visits,
      startedAt: now.toISOString(),
      renewsAt: ends.toISOString(),
      endsAt: ends.toISOString(),
      rolloverEndsAt: new Date(ends.getTime() + 30 * 86400000).toISOString(),
      amountMinor: option.amountMinor,
      currency: option.currency,
    };
    db.careSubscriptions.push(subscription);

    if (caseFile) {
      caseFile.subscription = subscription;
      if (caseFile.treatmentPlan) caseFile.treatmentPlan.agreedAt = now.toISOString();
    }
    return HttpResponse.json(subscription, { status: 201 });
  }),

  http.post(url('/care/subscriptions/:id/cancel'), ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const row = db.careSubscriptions.find((s) => s.id === params.id);
    if (!row) return HttpResponse.json({ message: 'Not found.' }, { status: 404 });
    row.status = 'cancelled';
    const caseFile = db.caseFiles.find((c) => c.id === row.caseId);
    if (caseFile) caseFile.subscription = row;
    return HttpResponse.json(row);
  }),

  /** Proposing again replaces a standing proposal, but never an agreement. */
  http.post(url('/cases/:id/plan'), async ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const caseFile = db.caseFiles.find((c) => c.caseId === params.id);
    if (!caseFile) return HttpResponse.json({ message: 'Not found.' }, { status: 404 });

    if (caseFile.subscription && caseFile.subscription.status === 'active') {
      return HttpResponse.json(
        {
          message: 'They have already paid for this plan. Close this course to start a new one.',
          code: 'plan_already_agreed',
        },
        { status: 409 },
      );
    }

    const body = (await request.json()) as {
      planId: string | null;
      cadence: string;
      startDate: string;
      endDate: string;
      summary: string;
      visits?: number;
      amount?: number;
    };

    if (body.cadence === 'custom' && body.visits && body.amount) {
      const id = `plan-custom-${caseFile.id}`;
      const amountMinor = Math.round(body.amount * 100);
      // Re-pricing replaces the row rather than leaving a trail of offers the
      // client could pay the wrong one of.
      const existing = db.carePlanOptions.findIndex((p) => p.id === id);
      if (existing >= 0) db.carePlanOptions.splice(existing, 1);
      db.carePlanOptions.unshift({
        id,
        cadence: 'custom',
        title: `${body.visits} visits`,
        durationLabel: 'agreed with your therapist',
        visits: body.visits,
        durationDays: 0,
        amountMinor,
        // Null unless it divides evenly — the card omits the line rather than
        // rounding to a figure nobody agreed to.
        perVisitMinor: amountMinor % body.visits === 0 ? amountMinor / body.visits : null,
        currency: 'USD',
        recommended: false,
        bespoke: true,
      });
      body.planId = id;
    }

    caseFile.treatmentPlan = {
      planId: body.planId,
      cadence: body.cadence,
      startDate: body.startDate,
      endDate: body.endDate,
      summary: body.summary.slice(0, 600),
      proposedAt: new Date().toISOString(),
      agreedAt: null,
    };
    caseFile.treatmentStartDate = body.startDate;
    caseFile.treatmentEndDate = body.endDate;
    return HttpResponse.json(caseFile.treatmentPlan, { status: 201 });
  }),

  http.post(url('/cases/:id/start'), ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const caseFile = db.caseFiles.find((c) => c.caseId === params.id);
    if (!caseFile) return HttpResponse.json({ message: 'Not found.' }, { status: 404 });

    // A start date against an unpaid plan would let sessions be booked
    // against visits nobody bought.
    if (!caseFile.subscription || caseFile.subscription.status !== 'active') {
      return HttpResponse.json(
        { message: 'They have not paid for this plan yet.', code: 'plan_not_paid' },
        { status: 409 },
      );
    }
    caseFile.treatmentStartedAt = new Date().toISOString();
    return HttpResponse.json(caseFile);
  }),

  /**
   * An entry in the recovery record. Refused before treatment has started —
   * there is nothing to report on, and a dated entry before the first session
   * would make the record say something untrue.
   */
  http.post(url('/cases/:id/progress'), async ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const caseFile = db.caseFiles.find((c) => c.caseId === params.id);
    if (!caseFile) return HttpResponse.json({ message: 'Not found.' }, { status: 404 });

    if (!caseFile.treatmentStartedAt) {
      return HttpResponse.json(
        {
          message: 'Start treatment before recording progress.',
          code: 'treatment_not_started',
        },
        { status: 409 },
      );
    }

    const body = (await request.json()) as {
      condition?: string;
      productsAdministered?: string | null;
      techniques?: string | null;
      trend?: string;
      recordedFor?: string;
    };

    // The one required field: an entry with no account of how the client is
    // doing is not a progress report.
    if (!body.condition?.trim()) {
      return HttpResponse.json(
        { message: 'Describe how the client is responding.', code: 'condition_required' },
        { status: 422 },
      );
    }

    // An entry dated next Tuesday makes the record say something untrue, the
    // same way one dated before the first session would.
    const recordedFor = body.recordedFor ?? new Date().toISOString().slice(0, 10);
    if (recordedFor > new Date().toISOString().slice(0, 10)) {
      return HttpResponse.json(
        { message: 'A report cannot be dated in the future.', code: 'recorded_for_in_future' },
        { status: 422 },
      );
    }

    const report = {
      id: db.nextId('progress'),
      authorId: user.id,
      condition: body.condition.trim(),
      productsAdministered: body.productsAdministered?.trim() || null,
      techniques: body.techniques?.trim() || null,
      trend: (body.trend as CaseProgressReport['trend']) || 'unchanged',
      recordedFor,
      createdAt: new Date().toISOString(),
    };

    // Newest first, matching how the case file carries them.
    caseFile.progressReports = [report, ...(caseFile.progressReports ?? [])];
    return HttpResponse.json({ data: report }, { status: 201 });
  }),

  /**
   * Pushes the treatment window out. The window belongs to the therapist, so
   * this needs no payment — but added *visits* are sessions nobody bought, so
   * they extend the subscription's allowance and are settled separately.
   */
  http.post(url('/cases/:id/extend'), async ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const caseFile = db.caseFiles.find((c) => c.caseId === params.id);
    if (!caseFile) return HttpResponse.json({ message: 'Not found.' }, { status: 404 });

    const plan = caseFile.treatmentPlan;
    if (!plan?.endDate) {
      return HttpResponse.json(
        { message: 'There is no treatment window to extend.', code: 'no_treatment_window' },
        { status: 409 },
      );
    }

    const body = (await request.json()) as {
      endDate?: string;
      addedVisits?: number;
      reason?: string;
    };

    if (!body.reason?.trim()) {
      return HttpResponse.json(
        { message: 'Say why this course needs longer.', code: 'reason_required' },
        { status: 422 },
      );
    }

    // An "extension" that shortens the window is a different operation with
    // different consequences, and this is not it.
    if (!body.endDate || Date.parse(body.endDate) <= Date.parse(plan.endDate)) {
      return HttpResponse.json(
        {
          message: 'The new end date has to be after the current one.',
          code: 'end_date_not_later',
        },
        { status: 422 },
      );
    }

    const addedVisits = Math.max(0, Math.trunc(body.addedVisits ?? 0));
    const now = new Date().toISOString();

    // Two payable top-ups would leave no answer to which end date won.
    const pending = (caseFile.treatmentExtensions ?? []).find(
      (e) => e.status === 'awaiting-payment',
    );
    if (pending) {
      return HttpResponse.json(
        {
          message: 'An extension is already waiting to be paid for.',
          code: 'extension_awaiting_payment',
        },
        { status: 409 },
      );
    }

    if (addedVisits > 0 && !caseFile.subscription) {
      return HttpResponse.json(
        {
          message: 'There is no priced plan to take a per-visit rate from.',
          code: 'no_treatment_plan',
        },
        { status: 409 },
      );
    }
    if (addedVisits > 0 && caseFile.subscription?.status !== 'active') {
      return HttpResponse.json(
        { message: 'They have not paid for this plan yet.', code: 'plan_not_paid' },
        { status: 409 },
      );
    }

    /**
     * More *time* is free and applies at once; more *visits* is a purchase and
     * applies only once it settles. Everything below turns on that one line —
     * it is the backend's answer to §2 and the reason this route has two
     * outcomes rather than one.
     */
    const subscription = caseFile.subscription;
    const perVisitMinor =
      subscription && subscription.visitsTotal > 0
        ? Math.round(subscription.amountMinor / subscription.visitsTotal)
        : 0;
    const amountMinor = addedVisits * perVisitMinor;
    const free = addedVisits === 0;

    const extension = {
      id: db.nextId('ext'),
      previousEndDate: plan.endDate,
      newEndDate: body.endDate,
      addedVisits,
      reason: body.reason.trim(),
      extendedAt: now,
      extendedBy: user.id,
      status: free ? ('applied' as const) : ('awaiting-payment' as const),
      planId: free ? null : db.nextId('plan-topup'),
      amountMinor,
      currency: subscription?.currency ?? 'USD',
      appliedAt: free ? now : null,
    };

    caseFile.treatmentExtensions = [...(caseFile.treatmentExtensions ?? []), extension];

    // The window moves now only when nothing is owed for it. An offer that has
    // not been paid for must not report itself as done.
    if (free) applyExtension(caseFile, extension);

    return HttpResponse.json(caseFile);
  }),

  /** Takes back an offer the client never paid for. Without it a pending
   *  extension blocks the next one forever. */
  http.delete(url('/cases/:id/extensions/:extensionId'), ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const caseFile = db.caseFiles.find((c) => c.caseId === params.id);
    if (!caseFile) return HttpResponse.json({ message: 'Not found.' }, { status: 404 });

    const extension = (caseFile.treatmentExtensions ?? []).find(
      (e) => e.id === params.extensionId,
    );
    if (!extension) return HttpResponse.json({ message: 'Not found.' }, { status: 404 });

    if (extension.status === 'applied') {
      return HttpResponse.json(
        {
          message: 'That has been paid for and applied.',
          code: 'extension_already_paid',
        },
        { status: 409 },
      );
    }

    // Kept rather than deleted: "we offered four more sessions and they did not
    // take them" is a fact about the course of treatment.
    extension.status = 'withdrawn';
    return HttpResponse.json(caseFile);
  }),

  http.post(url('/cases/:id/follow-up'), async ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const caseFile = db.caseFiles.find((c) => c.caseId === params.id);
    if (!caseFile) return HttpResponse.json({ message: 'Not found.' }, { status: 404 });
    const body = (await request.json()) as { dueAt: string; note?: string };
    caseFile.followUpDueAt = body.dueAt;
    caseFile.followUpNote = body.note?.trim() || null;
    return HttpResponse.json(caseFile);
  }),

  // ---- Case billing -------------------------------------------------------
  // Choosing is not paying: it prices the treatment so a deposit has something
  // to be 70% of, and charges nobody.
  http.post(url('/cases/:id/plan/choose'), async ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const caseFile = db.caseFiles.find((c) => c.caseId === params.id);
    if (!caseFile) return caseNotFound();

    if (caseFile.subscription?.status === 'active') {
      return HttpResponse.json(
        {
          message: 'You have already paid towards this treatment.',
          code: 'treatment_part_paid',
        },
        { status: 409 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as { planId?: string };
    const plan = db.carePlanOptions.find((option) => option.id === body.planId);
    if (!plan) {
      return HttpResponse.json({ message: 'That plan was not found.' }, { status: 404 });
    }

    caseFile.treatmentPlan = {
      ...(caseFile.treatmentPlan ?? { cadence: '', startDate: null, endDate: null, summary: null }),
      planId: plan.id,
    } as typeof caseFile.treatmentPlan;
    // The window stays as the therapist proposed it — the plan says what is
    // bought, the therapist says when it happens.
    caseFile.subscription = {
      ...(caseFile.subscription ?? {}),
      id: caseFile.subscription?.id ?? db.nextId('sub'),
      planId: plan.id,
      caseId: caseFile.caseId,
      cadence: plan.cadence,
      status: 'pending',
      visitsTotal: plan.visits,
      visitsUsed: 0,
      visitsRemaining: plan.visits,
      startedAt: null,
      renewsAt: null,
      endsAt: null,
      rolloverEndsAt: null,
      amountMinor: plan.amountMinor,
      currency: plan.currency,
    } as typeof caseFile.subscription;

    return billFor(caseFile);
  }),

  http.get(url('/cases/:id/bill'), ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const caseFile = db.caseFiles.find((c) => c.caseId === params.id);
    if (!caseFile) return caseNotFound();
    return billFor(caseFile);
  }),

  http.get(url('/cases/:id/recommendations'), ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const caseFile = db.caseFiles.find((c) => c.caseId === params.id);
    if (!caseFile) return caseNotFound();
    return HttpResponse.json({
      data: caseFile.recommendations,
      meta: { productDisclaimer: PRODUCT_DISCLAIMER },
    });
  }),

  // Accept only. There is no decline route — the therapist withdraws a line the
  // client does not want — so anything else 404s here as it does live.
  http.post(url('/cases/:id/recommendations/:lineId/accept'), async ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const caseFile = db.caseFiles.find((c) => c.caseId === params.id);
    if (!caseFile) return caseNotFound();
    const line = caseFile.recommendations.find((r) => r.id === params.lineId);
    if (!line) return HttpResponse.json({ message: 'Not found.' }, { status: 404 });

    const body = (await request.json().catch(() => ({}))) as { acknowledged?: boolean };
    // Insisted on rather than trusting that the screen rendered the text.
    if (body.acknowledged !== true) {
      return HttpResponse.json(
        { message: 'Please confirm you have read the product notice.', code: 'not_acknowledged' },
        { status: 422 },
      );
    }
    if (line.status === 'accepted') {
      return HttpResponse.json(
        { message: 'You have already answered this.', code: 'recommendation_already_answered' },
        { status: 409 },
      );
    }
    line.status = 'accepted';
    line.respondedAt = new Date().toISOString();
    caseFile.medicationTotal = caseFile.recommendations
      .filter((r) => r.status === 'accepted')
      .reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);
    return billFor(caseFile);
  }),

  http.delete(url('/cases/:id/recommendations/:lineId'), ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const caseFile = db.caseFiles.find((c) => c.caseId === params.id);
    if (!caseFile) return caseNotFound();
    const line = caseFile.recommendations.find((r) => r.id === params.lineId);
    if (!line) return HttpResponse.json({ message: 'Not found.' }, { status: 404 });
    if ((line.paidMinor ?? 0) > 0) {
      return HttpResponse.json(
        { message: 'That has been paid for.', code: 'recommendation_already_paid' },
        { status: 409 },
      );
    }
    caseFile.recommendations = caseFile.recommendations.filter((r) => r.id !== line.id);
    caseFile.medicationTotal = caseFile.recommendations
      .filter((r) => r.status === 'accepted')
      .reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);
    return billFor(caseFile);
  }),

  http.post(url('/cases/:id/close'), async ({ params, request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    const caseFile = db.caseFiles.find((c) => c.caseId === params.id);
    if (!caseFile) return HttpResponse.json({ message: 'Not found.' }, { status: 404 });
    const body = (await request.json()) as { summary: string };
    if (!body.summary?.trim()) {
      return HttpResponse.json(
        { message: 'Say how this course of treatment ended.', code: 'closing_summary_required' },
        { status: 422 },
      );
    }
    caseFile.status = 'closed';
    caseFile.closedAt = new Date().toISOString();
    caseFile.closingSummary = body.summary.trim();
    return HttpResponse.json(caseFile);
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
      recommendation?: { productId: string; note: string | null; quantity?: number };
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
      const qty = body.recommendation.quantity ?? 1;
      const unit = product?.price ?? 0;
      cf.recommendations.push({
        id: db.nextId('rec'),
        productId: body.recommendation.productId,
        productName: product?.name ?? 'Product',
        quantity: qty,
        unitPrice: unit,
        unitPriceMinor: Math.round(unit * 100),
        total: unit * qty,
        totalMinor: Math.round(unit * 100) * qty,
        currency: 'USD',
        note: body.recommendation.note,
        // Lands unanswered and costs nothing: only an accepted line is owed.
        status: 'pending' as const,
        paidMinor: 0,
        removable: true,
        recommendedAt: new Date().toISOString(),
        respondedAt: null,
      });
      // Only accepted lines count, matching the server.
      cf.medicationTotal = cf.recommendations
        .filter((r) => r.status === 'accepted')
        .reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);
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
const WITHDRAWAL_THRESHOLD = 200;
const moneyQuotes = new Map<string, { userId: string; quote: { id: string; kind: 'withdrawal' | 'transfer' | 'cooperative-contribution'; amount: number; fee: number; recipientReceives: number; balanceAfter: number; currency: string; expiresAt: string; recipient?: string; local: unknown }; stepUpVerified: boolean }>();
const topUpQuotes = new Map<string, { userId: string; quote: WalletTopUpQuote }>();

/** `${appointmentId}:${userId}` -> a standing yes. Absent is not agreement. */
const recordingConsent = new Map<string, boolean>();

/**
 * Unanimity, plus conditions the client cannot see. `canRecord` is the whole
 * answer so the record button is never shown where recording is switched off.
 */
function consentFor(appt: { id: string; clientId: string; therapistId: string }, userId: string) {
  const otherId = appt.clientId === userId ? appt.therapistId : appt.clientId;
  const mine = recordingConsent.get(`${appt.id}:${userId}`) === true;
  const theirs = recordingConsent.get(`${appt.id}:${otherId}`) === true;
  return { mine, theirs, canRecord: mine && theirs };
}

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
      // The top-level figures still mean the e-wallet and are untouched, so a
      // build that ignores `wallets` behaves exactly as it did.
      wallets: pursesFor(user.id, wallet),
      withdrawalWindow: withdrawalWindowNow(),
      local: db.localBlockFor(user.id, {
        available: wallet.available,
        pending: wallet.pending,
        cooperativeSaved: wallet.cooperativeSaved ?? 0,
      }),
    });
  }),

  /**
   * A therapist's share of what their clients have paid, per payment.
   *
   * The summary is computed over every row rather than the page — "due" meaning
   * "due on the rows we happened to load" is a false statement about somebody's
   * money.
   */
  http.get(url('/therapist/earnings'), ({ request }) => {
    const user = currentUser(request);
    if (!user) return unauthorized();
    if (!db.therapistIdForUser.get(user.id)) {
      return HttpResponse.json(
        { message: 'Only therapists have earnings.', code: 'therapist_required' },
        { status: 403 },
      );
    }

    const rows = db.earningsFor(user.id);
    const sum = (pick: (e: (typeof rows)[number]) => number) =>
      rows.reduce((total, row) => total + pick(row), 0);
    const due = rows.filter((r) => r.status === 'due');

    return HttpResponse.json({
      data: rows,
      meta: {
        nextCursor: null,
        hasMore: false,
        summary: {
          planSlug: db.therapistPlanFor(user.id),
          ratePercent: db.therapistRateFor(user.id),
          loyaltyPercent: LOYALTY_PERCENT,
          accruedMinor: rows.filter((r) => r.status === 'accrued').reduce((t, r) => t + r.grossMinor, 0),
          dueMinor: due.reduce((t, r) => t + r.grossMinor, 0),
          cashDueMinor: due.reduce((t, r) => t + r.cashMinor, 0),
          loyaltyDueMinor: due.reduce((t, r) => t + r.loyaltyMinor, 0),
          lifetimeMinor: sum((r) => r.grossMinor),
          currency: 'USD',
        },
        withdrawalWindow: withdrawalWindowNow(),
      },
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
    const body = await request.json() as { kind?: 'withdrawal' | 'transfer' | 'cooperative-contribution'; amount?: number; recipient?: string; wallet?: string };
    const wallet = db.wallets.get(user.id);
    const amount = Number(body.amount);
    if (!wallet || !body.kind || !Number.isFinite(amount) || amount <= 0) {
      return HttpResponse.json({ message: 'This amount is not available for an action.' }, { status: 422 });
    }

    /**
     * A withdrawal empties a *purse*, and by default the cash one — this is the
     * behaviour change under a shipped build, which sends no wallet and used to
     * mean the e-wallet. Transfers and contributions still spend the e-wallet.
     */
    const purses = pursesFor(user.id, wallet);
    const slug = body.kind === 'withdrawal' ? (body.wallet || 'cash') : 'ewallet';
    const purse = purses[slug as keyof typeof purses];

    if (body.kind === 'withdrawal') {
      if (!purse) {
        return HttpResponse.json(
          { message: 'That wallet does not exist.', code: 'wallet_not_withdrawable' },
          { status: 422 },
        );
      }
      if (!purse.capabilities.withdraw) {
        return HttpResponse.json(
          {
            message: `${purse.name} cannot be paid out to a bank account.`,
            code: 'wallet_not_withdrawable',
            meta: { wallet: purse.slug },
          },
          { status: 422 },
        );
      }
      // The wrong day, not the wrong amount — checked before a step-up code is
      // spent on a payout that was never going to be made.
      const openWindow = withdrawalWindowNow();
      if (!openWindow.open) {
        return HttpResponse.json(
          {
            message: 'Withdrawal requests are taken Tuesday to Friday. Payouts run on Mondays.',
            code: 'withdrawal_window_closed',
            meta: { opensAt: openWindow.opensAt, nextPayoutAt: openWindow.nextPayoutAt },
          },
          { status: 422 },
        );
      }
      // The floor is on the balance, not the request: $120 may give up $20,
      // $80 may give up nothing.
      if (purse.minimumReached === false) {
        return HttpResponse.json(
          {
            message: `${purse.name} opens at ${purse.minimumWithdrawal} ${wallet.currency}.`,
            code: 'loyalty_minimum_not_met',
            meta: {
              required: purse.minimumWithdrawal,
              available: purse.available,
              currency: wallet.currency,
            },
          },
          { status: 422 },
        );
      }
    }

    const spendable = purse?.available ?? wallet.available;
    if (amount > spendable) {
      return HttpResponse.json(
        {
          message: 'That is more than has cleared in this wallet.',
          code: 'insufficient_funds',
          meta: {
            wallet: purse?.slug ?? 'ewallet',
            available: spendable,
            pending: purse?.pending ?? 0,
            currency: wallet.currency,
          },
        },
        { status: 422 },
      );
    }
    if (body.kind === 'transfer' && !body.recipient?.trim()) {
      return HttpResponse.json({ message: 'Choose the member receiving this transfer.' }, { status: 422 });
    }
    if (body.kind === 'cooperative-contribution' && amount < 5) {
      return HttpResponse.json({ message: 'The minimum contribution is 5 USD.' }, { status: 422 });
    }
    // A balance the wallet must reach before any withdrawal, not a cap on the
    // amount. Server-configured in Laravel; the figure here is only large
    // enough to model the refusal, and the demo wallet clears it.
    if (body.kind === 'withdrawal' && slug === 'cash' && wallet.available < WITHDRAWAL_THRESHOLD) {
      return HttpResponse.json(
        {
          message: 'Your balance has not reached the amount required before a withdrawal can be made.',
          code: 'withdrawal_threshold_not_met',
          meta: {
            required: WITHDRAWAL_THRESHOLD,
            available: wallet.available,
            currency: wallet.currency,
          },
        },
        { status: 422 },
      );
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
    /** Set on case payments so settlement knows which case and which part. */
    subject?: string;
    item?: string;
  }
>();

const PLAN_PRICE_MINOR: Record<string, number> = { 'free-trial': 0, monthly: 1500, yearly: 20000 };

/**
 * Credits a wallet once its funding payment settles, and files the inbox row
 * a push would point at. Idempotent: the quote is consumed, so a second
 * confirm (a retry, or the polling GET) cannot credit the wallet twice.
 */
/**
 * What one named item is worth right now, in minor units.
 *
 * The deposit must be covered before the balance: paying the 30% first would
 * leave treatment unable to start, which is the opposite of what the client
 * was trying to do.
 */
function caseItemDueMinor(caseId: string, item: string | undefined): number {
  const caseFile = db.caseFiles.find((c) => c.caseId === caseId);
  if (!caseFile) return 0;

  const accepted = caseFile.recommendations.filter((r) => r.status === 'accepted');
  const productsMinor = accepted.reduce((sum, r) => sum + r.unitPriceMinor * r.quantity, 0);
  const treatmentMinor = caseFile.subscription?.amountMinor ?? 0;
  const settled = paidFor(caseId);
  const treatmentOutstanding = Math.max(0, treatmentMinor - settled.treatmentMinor);
  const productsOutstanding = Math.max(0, productsMinor - settled.productsMinor);

  const splittable = planDurationDays(caseFile) > MINIMUM_PLAN_DAYS && treatmentMinor > 0;
  const depositMinor = Math.round(treatmentMinor * 0.7);
  const depositOutstanding = Math.max(0, depositMinor - settled.treatmentMinor);

  switch (item) {
    case 'treatment-deposit':
      return splittable ? depositOutstanding : treatmentOutstanding;
    case 'treatment-balance':
      return splittable ? Math.max(0, treatmentOutstanding - depositOutstanding) : 0;
    case 'treatment':
      return treatmentOutstanding;
    case 'products':
      return productsOutstanding;
    case 'extensions':
      return (caseFile.treatmentExtensions ?? [])
        .filter((e) => e.status === 'awaiting-payment')
        .reduce((sum, e) => sum + e.amountMinor, 0);
    /**
     * The instalment due now, plus the goods. On a splittable plan the deposit
     * is what is due until it is settled, and the balance only afterwards —
     * the same order the schedule renders, resolved here so the device never
     * has to decide it.
     */
    case 'due-plus-products': {
      const treatmentDue = splittable
        ? depositOutstanding > 0
          ? depositOutstanding
          : Math.max(0, treatmentOutstanding - depositOutstanding)
        : treatmentOutstanding;
      return treatmentDue + productsOutstanding;
    }
    default:
      return treatmentOutstanding + productsOutstanding;
  }
}

/** Applies a settled case payment to the component it was for. */
function creditSettledCasePayment(intent: { purpose: string; subject?: string; item?: string }) {
  if (intent.purpose !== 'case-balance' || !intent.subject) return;
  const caseId = intent.subject;
  const settled = paidFor(caseId);
  const caseFile = db.caseFiles.find((c) => c.caseId === caseId);
  if (!caseFile) return;

  const accepted = caseFile.recommendations.filter((r) => r.status === 'accepted');
  const productsMinor = accepted.reduce((sum, r) => sum + r.unitPriceMinor * r.quantity, 0);
  const treatmentMinor = caseFile.subscription?.amountMinor ?? 0;

  const item = intent.item ?? 'everything';
  // `due-plus-products` settles two components at once, so it credits both —
  // its treatment share is the instalment that was due, not the whole plan.
  const treatmentItem =
    item === 'everything'
      ? 'treatment'
      : item === 'due-plus-products'
        ? 'due-plus-products-treatment'
        : item;
  const treatmentAdd =
    item === 'products'
      ? 0
      : treatmentItem === 'due-plus-products-treatment'
        ? caseItemDueMinor(caseId, 'due-plus-products') - Math.max(0, productsMinor - settled.productsMinor)
        : caseItemDueMinor(caseId, treatmentItem);
  const productsAdd =
    item === 'products' || item === 'everything' || item === 'due-plus-products'
      ? productsMinor
      : 0;

  casePaid.set(caseId, {
    treatmentMinor: Math.min(treatmentMinor, settled.treatmentMinor + treatmentAdd),
    productsMinor: Math.min(productsMinor, settled.productsMinor + productsAdd),
  });

  /**
   * Paying for a pending extension is what makes it real. Until this, the end
   * date had not moved and the visits were not the client's to book.
   */
  if (item === 'extensions' || item === 'everything') {
    for (const extension of caseFile.treatmentExtensions ?? []) {
      if (extension.status === 'awaiting-payment') applyExtension(caseFile, extension);
    }
  }

  // The deposit is what opens the subscription — a client who has paid 70% can
  // book the visits they paid for.
  const nowPaid = paidFor(caseId).treatmentMinor;
  const depositMinor = Math.round(treatmentMinor * 0.7);
  if (caseFile.subscription && nowPaid >= depositMinor && depositMinor > 0) {
    caseFile.subscription = { ...caseFile.subscription, status: 'active' };
  }
}

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
      item?: string;
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
    // A case payment is priced from the bill by named item, never from an
    // amount the app supplied — there is no way to ask for a figure the rules
    // do not allow, because the app never names one.
    const caseDue =
      body.purpose === 'case-balance' ? caseItemDueMinor(body.subject ?? '', body.item) : 0;

    const baseAmount = topUp
      ? topUp.quote.totalCharge
      : body.purpose === 'therapist-plan'
        ? (PLAN_PRICE_MINOR[body.subject ?? ''] ?? 0) / 100
        : body.purpose === 'case-balance'
          ? caseDue / 100
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
      // Remembered so settlement knows which component it paid for; the app
      // never sends the amount, only the name of the piece.
      subject: body.subject,
      item: body.item,
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
    if (status === 'settled') {
      creditSettledTopUp(user.id, intent);
      creditSettledCasePayment(intent);
    }

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
