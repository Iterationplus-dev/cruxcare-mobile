# CruxCare Mobile — Frontend API Handoff for Laravel

**Audience:** Senior Laravel engineer

**Status:** Frontend contract audit as of 12 August 2026, amended 18 August 2026. The mobile app has a working mock API layer for the Phase 0/1 surface. It is ready to switch to Laravel once the contracts below are available.

> **Amended 18 August 2026.** Push notifications and gateway payments are now wired end-to-end in the client, so the "not connected in current frontend code" caveats below no longer hold for them. Their contracts have moved to dedicated notes:
> - **[`PUSH_NOTIFICATIONS_CONTRACT.md`](PUSH_NOTIFICATIONS_CONTRACT.md)** — `POST /devices/token`, `DELETE /devices/token/{installationId}`, `GET`/`PATCH /notifications/prefs`, and the FCM payload contract.
> - **[`PAYMENTS_MONNIFY_CONTRACT.md`](PAYMENTS_MONNIFY_CONTRACT.md)** — Monnify selected as the gateway; `POST /payments/intents`, `POST /payments/intents/{ref}/confirm`, `GET /payments/intents/{ref}`, plus webhook handling.

## 1. Integration boundary

The Ionic/Vue/Capacitor app calls a versioned JSON API only:

```text
VITE_API_BASE_URL = https://<host>/api/v1
Authorization      = Bearer <Sanctum personal-access-token>
```

`VITE_USE_API_MOCKS=true` currently routes requests to MSW fixtures in `src/mocks/`. Set it to `false` when a reachable Laravel environment is ready. The frontend sends `Accept: application/json`, has a 15-second request timeout, stores the access token in native secure storage, and logs the user out on `401`.

Important: resources are returned directly — do **not** wrap individual resources in `{ data: ... }`. Lists use the cursor shape below.

```json
{
  "data": ["..."],
  "meta": { "nextCursor": "opaque-cursor-or-null", "hasMore": false }
}
```

Dates are ISO-8601 UTC strings. The current TypeScript models consume monetary values as JSON numbers and a three-letter `currency` string. Preserve that for the first integration unless the frontend is changed in tandem to parse decimal strings.

## 2. Cross-cutting API rules

| Concern | Required backend behaviour |
| --- | --- |
| Authentication | Sanctum bearer tokens per device. A login/register response returns `{ user, token }`. The app rehydrates through `GET /me`; it has no refresh-token call yet. |
| Roles and access | A user can have several roles. Return authoritative `roles[]` and `capabilities[]` in every `User` response; UI visibility is advisory, Laravel remains the enforcer. |
| Errors | Return `{ "message": string, "code"?: string, "errors"?: { field: string[] }, "meta"?: object }`. Use `422` for validation or rejected business rules, `401` for unauthenticated, `403` for authenticated-but-forbidden, and `404` for inaccessible/missing records. |
| Idempotency | Persist and replay the outcome for a duplicate `Idempotency-Key` on checkout and every financial write. Do not merely de-duplicate in memory. |
| Money | Totals, fees, eligibility, interest, available balance, and settlement states are server-authoritative. Never trust or derive them from client input. |
| Permissions and audit | Enforce policies for health/case data, therapist client limits, therapist/admin orders, financial approvals, and all admin actions. Audit access to health/case records and financial decisions. |
| Pagination | Cursor pagination is implemented for products, orders, appointments, case files, wallet ledger, therapist search, and chat messages. First page omits `cursor`; return `nextCursor: null, hasMore: false` at the end. |
| Caching | Support `ETag` / `If-None-Match` for the product catalog. Immutable media should be served from a CDN/S3-compatible URL. |
| Offline | The mobile UI disables money writes when offline. A connection retry must remain safe through idempotency; do not issue optimistic financial success. |

## 3. Authoritative mobile user object

The following response is used by registration, login, `GET /me`, profile updates, membership linking, and therapist activation.

```json
{
  "id": "user-123",
  "firstName": "Amaka",
  "lastName": "Obi",
  "email": "amaka@example.com",
  "phone": "+2348012345678",
  "avatarUrl": null,
  "roles": ["client", "member", "therapist"],
  "capabilities": [
    "orders.place",
    "appointments.book",
    "health-profile.write",
    "case-files.manage",
    "wallet.read",
    "wallet.write",
    "admin.approve"
  ],
  "referredBySource": "friends-family",
  "membership": {
    "cruxId": "CCI8804XO",
    "tier": "Bronze · Unit Leader",
    "joinedAt": "2026-08-12T09:30:00Z"
  },
  "therapistProfile": {
    "plan": "monthly",
    "status": "active",
    "clientLimit": null,
    "caseFileLimit": null,
    "clientCount": 4,
    "caseFileCount": 3
  },
  "payoutAccount": {
    "accountHolder": "Amaka Obi",
    "institution": "Example Bank",
    "accountNumber": "0123456789"
  },
  "biometricEnabled": false,
  "createdAt": "2026-08-12T09:30:00Z"
}
```

Supported roles are `client`, `member`, `therapist`, and `admin`. The currently consumed capability strings are `orders.place`, `appointments.book`, `health-profile.write`, `case-files.manage`, `wallet.read`, `wallet.write`, and `admin.approve`. The capability list should be extensible.

## 4. Build-now API surface

These routes have typed frontend client methods and MSW equivalents today. This is the integration priority.

### 4.1 Auth, account, recovery, and role activation

| Method and path | Request | Response / behaviour |
| --- | --- | --- |
| `POST /auth/register` | `firstName`, `lastName`, `email`, `phone`, `password`, `referredBySource` | `201` (or `200`) `{ user, token }`; creates only the `client` role and wallet. Valid referral values: `facebook`, `whatsapp`, `member`, `therapist`, `admin`, `google-ads`, `friends-family`, `other`. |
| `POST /auth/login` | `{ identifier, password }`, where identifier is a username or a uniquely matched email | `{ user, token }`. Username takes precedence, including usernames containing `@`; phone is not a login identifier. Invalid credentials return generic `401` + `code: "invalid_credentials"` and `meta.attemptsRemaining`; an ambiguous email returns `401` + `code: "use_username"` with displayable guidance to use a username. |
| `POST /auth/otp/request` | `{ channel: "sms" \| "whatsapp", purpose: "signup" \| "recovery" \| "member-link" }` | Send/queue OTP. Return at least `200`; expiry, retry limit and resend cooldown should be server-owned. |
| `POST /auth/otp/verify` | `{ code, purpose }` | `{ verified: true }`, or `422` with `code: "otp_invalid"` and `meta.attemptsRemaining`. The current visual contract is a five-digit code, expires in 10 minutes, and three wrong attempts lock/replace it. |
| `POST /auth/biometric/enable` | none | Marks device opt-in and returns `{ enabled: true }`. Biometrics remain device-side; Laravel should never receive biometric material. |
| `POST /auth/logout` | none | Revokes only this device token and returns `204` or `{ loggedOut: true }`. |
| `POST /auth/password/forgot` | `{ identifier, channel: "sms" \| "whatsapp" \| "email" }` | Always respond generically to avoid account enumeration. The UI tells users a reset signs out all devices and pauses payouts for 24 hours; implement/confirm that policy. |
| `POST /auth/password/reset` | `{ identifier, code, newPassword, signOutOtherDevices }` | Reset password, revoke devices as requested/policy, and return `204` or `{ reset: true }`. |
| `POST /auth/recovery/assisted` | `{ identifier, contact, description }` | `{ caseNumber }`; creates a support recovery case. |
| `GET /me` | — | Current authenticated `User`. |
| `PATCH /me` | Any of `firstName`, `lastName`, `avatarUrl`, `payoutAccount` | Updated `User`. Do not allow arbitrary fields/roles to be mass assigned. |
| `POST /me/delete` | `{ password }` | `{ deletionCompletesAt }`; the UI displays a reversible 30-day deletion window. A cancellation/restore endpoint is not yet wired and needs agreement before implementation. |
| `POST /me/membership/link` | `{ cruxId }` after OTP verification | Updated `User` with member role/capabilities. Validate an existing membership and its owner; the client validates `^[A-Z]{3}\d{4}[A-Z]{2}$`. Never accept a user-supplied Crux ID as proof of ownership. |
| `POST /me/therapist/activate` | `{ plan: "free-trial" \| "monthly" \| "yearly", paymentToken }` | A priced plan is only activated once paid. A wallet token (`wallet` or `wallet:*`) settles against the ledger and returns the updated `User`/`therapistProfile`; any other token is an unverified gateway reference, so the subscription is stored `pending`, the therapist role is withheld, and the reply is `202 { status: "pending_payment", reference, plan, amount, currency, message }`. Free plans skip payment. `422 insufficient_funds` carries `meta.available`/`meta.required`/`meta.currency`. Member status, plan eligibility and payment stay server-enforced. |

Registration performs local validation: first and last name required, valid email, digits-only phone with at least seven digits, password minimum eight characters and at least one number, plus terms/privacy consent. The consent checkbox is currently UI-only; product should decide whether registration needs a `termsVersion`/consent receipt field before backend implementation.

### 4.2 Marketplace and orders

| Method and path | Request/query | Response / backend rule |
| --- | --- | --- |
| `GET /products` | `search?`, `category?`, `sort=price-asc\|price-desc\|popular`, `cursor?` | Cursor page of `Product`. A product has `id`, `name`, `description`, `price`, `currency`, `stock`, `category`, `media: [{ url, alt }]`. Guest browsing is allowed; order/cart mutations require auth. |
| `GET /products/{id}` | — | `Product`; use `404` for unpublished/inaccessible products. |
| `GET /cart` | — | `{ items: [{ id, product, quantity }], subtotal, currency }`. Recalculate price and availability on every read. |
| `POST /cart/items` | `{ productId, quantity }` | Updated `Cart`. Validate positive quantity and purchasable stock. |
| `DELETE /cart/items/{itemId}` | — | Updated `Cart`. |
| `GET /cart/checkout-quote` | — | `{ subtotal, fees, total, currency, walletBalanceAfter, expiresAt }`. This is the amount shown before payment. Reserve stock for the quoted period (UI copy says 10 minutes) and invalidate safely if it changes. |
| `POST /orders` | `Idempotency-Key` + `{ paymentToken }` | `Order`. Verify payment/wallet balance, use current prices/stock, consume a valid quote/reservation, and return a non-optimistic state. |
| `POST /orders/on-behalf` | `Idempotency-Key` + `{ clientId, paymentToken }` | `Order`; therapist/admin only, with attribution and audit record. |
| `GET /orders` | `cursor?` | Cursor page of current user’s permitted orders. |
| `GET /orders/{id}` | — | `Order`; owner/attributed purchaser/admin policy required. |

```json
{
  "id": "order-123",
  "reference": "ORD-1042",
  "items": [{ "productId": "prod-1", "productName": "Cayenne Miracle Capsules", "quantity": 2, "unitPrice": 18.5 }],
  "total": 37,
  "currency": "USD",
  "status": "pending",
  "placedById": "user-123",
  "onBehalfOfId": null,
  "timeline": [{ "status": "pending", "at": "2026-08-12T10:00:00Z", "note": "Order placed" }],
  "createdAt": "2026-08-12T10:00:00Z"
}
```

The app currently sends an opaque single-use `paymentToken` from a hosted provider UI. Payment provider selection is open; card PAN/CVV must never reach the app API. Wallet payment is the only rendered selection today, but the API should retain a provider-agnostic payment reference/intent rather than treating that token as card data.

### 4.3 Client care and therapist-facing data

| Method and path | Request/query | Response / backend rule |
| --- | --- | --- |
| `GET /therapists` | `cursor?` | Cursor page of `TherapistSummary`: `id`, `name`, `avatarUrl`, `specialties[]`, `rating`, `location`, `bio`, `experienceYears`, `languages[]`, `nextAvailableSlot`, `fullyBooked`. |
| `GET /therapists/{id}` | — | `TherapistSummary`. |
| `POST /care/requests` | `{ reason, therapistId? }` | Create care/therapist assignment request; return `201/202` with `therapistId`. A named therapist is attached to the case and notified so it reaches their queue; without one the request stays open. Final assignment remains a staff workflow either way. `422 therapist_unavailable` if the id is not a bookable therapist. Returns the full `CareRequest` (see `GET /care/requests`) so the client can show it immediately. `status` vocabulary: `submitted`, `in-review`, `accepted`, `declined`, `cancelled`, `closed`; an unknown value is rendered with a neutral "in progress" treatment rather than rejected. A request naming a therapist opens at `in-review` (someone has it); an unnamed one opens at `submitted` (nobody has looked yet). Creation always writes one event, so a fresh request never returns `events: []`. |
| `GET /care/requests` | `cursor?` | Cursor page of the **caller's own** `CareRequest`, newest first: `id`, `reference`, `status`, `reason`, `therapistId`, `therapistName`, `therapistAvatarUrl`, `createdAt`, `updatedAt`, `events[]`. `events` is the progress trail the client screen renders — `{ id, status, label, note?, at }`, oldest first, one entry per real step. The app never invents a step, so a request with no recorded progress must return an empty array rather than a synthesised one. |
| `GET /care/requests/{id}` | — | One `CareRequest`. Scope to the owning client. |
| `POST /care/requests/{id}/cancel` | — | Updated `CareRequest` with `status: "cancelled"` and an appended event. `422 request_not_cancellable` once the request is `accepted`, `closed`, or already `cancelled` — carrying `meta.status` with the true state, which the client re-renders from rather than trusting its own copy. Accepts the `id` or the `reference`. Someone else's request is a `404`, never a `403`, which would confirm it exists. |
| `GET /therapist/care-requests` | `cursor?` | **Not built yet — see the note below.** Cursor page of the caller's incoming `TherapistCareRequest`, newest first: `id`, `reference`, `status`, `reason`, `clientId`, `clientName`, `clientAvatarUrl`, `createdAt`, `updatedAt`, `events[]`. Same underlying record as the client's `CareRequest` and the same `events` trail — it carries the **client** instead of the therapist, because that is the identity being decided about. Scope server-side to requests whose `therapistId` is the caller's own therapist profile; the app never sends a therapist id. A caller with no therapist profile gets an empty page, not a `403`. Requests with no named therapist never appear here — nobody was asked. |
| `POST /therapist/care-requests/{id}/accept` | — | **Not built yet.** Updated `TherapistCareRequest` with `status: "accepted"` and an appended event, written for the client who reads the same trail. Creates the working relationship — case file, chat thread, and whatever else assignment implies. `422 request_not_actionable` unless the request is `submitted` or `in-review`, carrying `meta.status` with the true state, which the app re-renders from rather than trusting its own copy. `422 therapist_plan_required` when the therapist has no active plan or is at their client limit: the app disables the button, but the limit is a server rule and must be enforced here. Someone else's request is a `404`, never a `403`. Must be idempotent enough that a double tap does not assign twice. |
| `POST /therapist/care-requests/{id}/decline` | — | **Not built yet.** Updated `TherapistCareRequest` with `status: "declined"` and an appended event; notify the client so staff can re-match. Same `404`/`422 request_not_actionable` rules as accept. **Not** gated by the plan — passing on a case consumes no client slot. |
| `GET /appointments` | `cursor?` | Cursor page of `Appointment`. Scope it to client, assigned therapist, or administrator. |
| `POST /appointments` | `{ therapistId, slot, type }`, `type` is `in-person\|video\|chat` | Creates requested appointment. Revalidate live availability and care/plan access atomically. |
| `PATCH /appointments/{id}` | `{ status }` | Updated appointment. Current UI supplies status only; Laravel must authorize valid transitions (`requested`, `confirmed`, `completed`, `cancelled`, `no-show`). A later rescheduling request needs an explicit slot payload/contract. |
| `GET /health-profile` | — | Current client `HealthProfile`. |
| `PUT /health-profile` | `{ sections: [{ key, label, value }], consentVersion }` | Updated `HealthProfile`. Persist consent timestamp/version and validate whitelisted health-section keys. |
| `GET /case-files` | `cursor?` | Cursor page of accessible therapist/admin case files. |
| `GET /case-files/{id}` | — | `CaseFile`; needed by the screen even though it is not called from all navigation paths yet. |
| `PATCH /case-files/{id}` | `{ note: { body, draft } }` **or** `{ recommendation: { productId, note } }` | Updated `CaseFile`. Prefer separate command routes in later API version if that better fits domain behaviour, but preserve these payloads during current mobile integration. |
| `GET /chat/threads` | — | Array of authorized `ChatThread` records. |
| `GET /chat/threads/{id}/messages` | `cursor?` | Cursor page of `ChatMessage`. |
| `POST /chat/threads/{id}/messages` | `{ body }` | Created `ChatMessage`. Attachments are modeled but the composer does not upload them yet. |

```json
{
  "id": "appt-1",
  "clientId": "user-123",
  "clientName": "Amaka Obi",
  "therapistId": "therapist-1",
  "therapistName": "Chidi Nwosu",
  "slot": "2026-08-20T10:00:00Z",
  "type": "video",
  "status": "requested",
  "reason": null,
  "cancellationCutoff": "2026-08-20T08:00:00Z"
}
```

#### Backend note — the therapist never receives a client's request

`POST /care/requests` already says a named therapist "is attached to the case and notified so it reaches their queue". **There is no queue to reach.** The only read route for a care request is `GET /care/requests`, which is scoped to *the caller's own* requests as a client — so a therapist calling it gets the requests they sent, never the ones sent to them. A client can name a therapist, the request is stored, and nothing ever puts it in front of that therapist. The therapist's Appointments screen is not it: an `Appointment` is a separate record with its own `requested` status, and nothing converts a `CareRequest` into one.

The three routes above close that gap and **need building server-side**; the mobile side is done and calls them already:

- `src/api/care-queue.api.ts` — `careQueueApi.list/accept/decline`
- `src/composables/useTherapistCareRequests.ts`
- `src/features/therapist/screens/TherapistCareRequestsScreen.vue` at `/therapist/care-requests`, with a waiting-requests banner on the therapist's Today dashboard

Until the routes exist the screen renders its empty state, which is honest but wrong — the requests are real and sitting in the database unseen.

Three things to get right, none of which the app can do for you:

1. **Scope by the caller's therapist profile, server-side.** The app never sends a therapist id, so there is nothing to tamper with. Keep it that way.
2. **Enforce the plan and client limits on `accept`.** The screen disables the button when the therapist has no active plan, but that is a courtesy, not a control — the handoff already requires these limits be enforced server-side rather than inferred from `clientCount`.
3. **Write the event for the client, not the therapist.** Both sides render the same `events[]` array, so a step reading "you accepted" would appear on the client's own tracking screen. Phrase it as `"{therapistName} accepted your request"`.

Two adjacent issues worth fixing at the same time:

- **The notification deep-link.** `POST /care/requests` sends the therapist a notification whose `actionRoute` was `/therapist/appointments` — a screen that will never show the request. It should be `/therapist/care-requests`. Fixed in the mock; make sure the real payload matches.
- **`GET /notifications` must be per-recipient.** The MSW mock serves one global array, so a therapist-addressed notification shows up in the client's inbox. That is a mock artifact and the contract at `GET /notifications` is already implicitly per-caller, but this flow is the first one where two different people are notified about the same record — worth confirming the real implementation scopes it.

```json
{
  "id": "care-req-1042",
  "reference": "CR-1755000000000",
  "status": "in-review",
  "reason": "Amaka Obi would like to work with Chidi Nwosu.",
  "clientId": "user-123",
  "clientName": "Amaka Obi",
  "clientAvatarUrl": null,
  "createdAt": "2026-08-24T10:00:00Z",
  "updatedAt": "2026-08-24T10:00:00Z",
  "events": [
    {
      "id": "care-evt-1",
      "status": "in-review",
      "label": "Request sent to Chidi Nwosu",
      "note": "They have been notified and will respond shortly.",
      "at": "2026-08-24T10:00:00Z"
    }
  ]
}
```

Health profiles and case files are sensitive data. Return them only to the client, appropriately assigned/confirmed therapist, and authorized administrators; apply encryption at rest, Laravel policies, minimum necessary fields, audit logs, and consent withdrawal handling. Therapist free-trial limits (one client and one case file) must be enforced server-side, not inferred from `clientCount` or `caseFileCount` in the response.

### 4.4 Wallet, ledger, withdrawal, and member transfer

| Method and path | Request | Response / backend rule |
| --- | --- | --- |
| `GET /currencies` | — | `{ base: "USD", source, supported[], mine }`. The only source of truth for which currencies exist and what they are worth — the client hard-codes none of it. Per entry: `countryId`, `country`, `currency`, `rate` (units per 1 USD, `null` when unavailable), `rateSource`, `fundable`. `fundable` is the only field that gates a currency in the UI: a currency can be supported but temporarily unpriced, and offering it would misprice a payment. `mine` is resolved server-side from the caller's profile address, so the app never asks a user to pick their own currency; `null` for a user with no supported country. Top-level `source` is the admin's platform-wide selection, per-entry `rateSource` is what actually priced that currency — they differ during a provider outage. |
| `GET /wallet` | — | `{ available, pending, committed?, cooperativeSaved?, currency, lastUpdatedAt, local }`. Balances are display values returned by the server, never client-computed. `local` is the same balances converted for display — `{ currency, country, rate, rateSource, available, pending, cooperativeSaved }` — or **`null`** (the whole object, never an object of zeroes) when the user has no supported country or no rate could be established. Amount keys mirror the base keys exactly so one formatter walks both. |
| `GET /wallet/ledger` | `cursor?` | Cursor page of signed `Transaction` entries. |
| `POST /wallet/topups` | `Idempotency-Key` + `{ amount }` (always USD — the client never sends a local amount) | A `WalletTopUpQuote`: `{ id, amount, fee, totalCharge, walletCreditedWith, balanceAfter, currency, expiresAt, local }`. **The fee is added on top, not deducted**: `totalCharge = amount + fee` and `walletCreditedWith = amount`, so someone funding 50 pays 50.75 and receives 50. The quote lives **30 minutes**, not the 5 a money quote gets, because paying by bank transfer means leaving the app. `local` restates only the charged figures — `amount`, `fee`, `totalCharge` — so the review screen can show what the sheet will charge before the intent exists; `balanceAfter` has no local twin because the wallet is held in USD. Funding is the one flow where the customer names the figure, but the **charge** is still server-derived — the app sends the requested amount and displays whatever `totalCharge` comes back. Enforce minimums, per-user funding limits and the gateway fee here. `422 invalid_amount` below the minimum. The quote is settled by a payment intent (`purpose: "wallet-topup"`, `subject: <quote id>`), **not** by `POST /wallet/actions`: no balance is being spent, so there is no step-up to clear. Credit the wallet only on the gateway's server-to-server confirmation, and make it idempotent — a retried confirm and the polling `GET` must not credit twice. |
| `POST /wallet/quotes` | `Idempotency-Key` + `{ kind: "withdrawal" \| "transfer", amount, recipient? }` | A short-lived `MoneyQuote`. Validate recipient Crux ID, current balance, eligibility, fees, and payout routing. UI expects 5-minute expiry. Carries the same nullable `local` block with the quote's own fields converted (`amount`, `fee`, `recipientReceives`, `balanceAfter`); for a withdrawal that is what actually lands in the user's bank. **The quote holds its own rate** — the client renders that block and never re-converts, so a rate moving between quote and execute does not change what the user was shown. |
| `POST /wallet/quotes/{id}/step-up` | `Idempotency-Key` + `{ code }` | `204` or `{ ok: true }`. Verify a purpose-bound security OTP/step-up action, never a generic reusable code. |
| `POST /wallet/actions` | `Idempotency-Key` + `{ quoteId }` | `{ reference, status: "processing", quote }`. Verify quote ownership, expiry, quote immutability, completed step-up, and recheck balance before a single ledger/settlement workflow is created. |

```json
{
  "id": "quote-123",
  "kind": "transfer",
  "amount": 100,
  "fee": 5,
  "recipientReceives": 95,
  "balanceAfter": 148.5,
  "currency": "USD",
  "expiresAt": "2026-08-12T10:05:00Z",
  "recipient": "CCI8804XO"
}
```

The rule is **minimum 5% admin charge** for withdrawals and member-to-member transfers. Laravel’s shared finance service must calculate it; the frontend only renders returned values. A `Transaction` is `{ id, reference, type, amount, fee, currency, description, createdAt }`, where signed `amount` is authoritative. Status `processing` must not be presented as settlement/approval.

### 4.5 Notifications

| Method and path | Request | Response / backend rule |
| --- | --- | --- |
| `GET /notifications` | — | Array of `AppNotification`: `id`, `category`, `title`, `body`, `read`, `actionLabel`, `actionRoute`, `createdAt`. Current categories are `appointments`, `orders`, `wallet`, `chat`, `system`. |
| `PATCH /notifications/{id}` | `{ read: true }` | `204` or `{ ok: true }`; it must only mutate the caller’s notification. |

Notification preferences and device registration **are now connected** in the frontend. Their request/response shapes, the FCM payload contract, and the native defects fixed alongside them are in [`PUSH_NOTIFICATIONS_CONTRACT.md`](PUSH_NOTIFICATIONS_CONTRACT.md).

## 5. Realtime and native-device requirements

The present chat UI fetches and posts through REST. The PRD requires Laravel Echo/Reverb for chat messages, presence, Point Facility signaling, payout status, approvals, and appointment changes. The mobile client is **not yet wired to Echo**, so agree on exact channel/event names before implementing it. A suitable direction is private user channels for notifications and private/presence channels scoped to an authorized chat thread, appointment/video room, or Point Facility center; the broadcast authorization endpoint must apply the same Laravel policies as REST.

Push uses Capacitor FCM/APNs and **is now wired end-to-end**: the app requests permission, registers, uploads its token to `POST /devices/token`, revokes it on sign-out, and deep-links on tap. The full contract — including the FCM payload shape, upsert-on-`installationId` rule, and the still-outstanding `google-services.json` — is in [`PUSH_NOTIFICATIONS_CONTRACT.md`](PUSH_NOTIFICATIONS_CONTRACT.md). Never use the push token as an authentication credential.

Video is currently a mock provider. The selected SFU (Agora, Twilio, Daily, or LiveKit) should be hidden behind backend-issued short-lived, room-scoped credentials. Create/join endpoints must enforce appointment/Point Facility entitlement and persist recording consent before a recording is started.

## 6. Designed but not API-wired yet

The following screens exist and communicate the intended backend capability, but their UI currently uses sample/static values. Do not treat them as a working mobile contract until the frontend adds typed clients. They are the next API design workstream, based on the PRD.

| Area | Product API surface to design | Non-negotiable rules |
| --- | --- | --- |
| Network and rank | `GET /network/referral-link`, `GET /network/downline`, `GET /rank`, `GET /rank/next` | Downline counts are server-authoritative and aggregate across the four platforms; scope data by rank/permissions. Bronze/Silver earnings remain TBD. |
| Commitment | `GET/POST /commitments`, `POST /commitments/{id}/notice`, `POST /commitments/{id}/interest/withdraw` | Member-only. 1.8% monthly accrual, lock duration, 3-month interest-withdrawal gate, 60-day capital-return notice, fee quote/step-up/idempotency and shared finance service. |
| Cooperative | `GET /coop/account`, `POST /coop/contributions`, `POST /coop/help`, `POST /coop/help/{id}/guarantors`, `POST /coop/transfers` | 52-week account; min $5 contribution; 12 consistent weeks before Open-savings help; 3 valid Crux-ID guarantors; help cap is 50 weeks; contributions automatically repay help; closed/no-help annual interest rule. |
| Care plans and video | `GET /care/plans`, `POST /care/subscriptions`, `POST /video/sessions`, `POST /video/sessions/{id}/token` | Plan/cadence and access gates must be server-derived; recording consent is versioned/audited. |
| Therapist management | roster, availability, appointment-management, earnings, payout account, and case-file attachment endpoints | Current therapist dashboard mostly has static sample data. Enforce plan limits and client assignments in policies/services. |
| Point Facility | `GET/POST /point/centers`, `POST /point/centers/{id}/resources`, `POST /point/centers/{id}/join` | Host rank/therapist-plan gate; client subscription gate; capacity, presence, moderation and recording consent. |
| Admin | `POST /admin/assign-client`, `POST /admin/approvals/{id}` plus queue/list endpoints | Approval types include payouts, cooperative help, and capital-return notices. Actions require audit data and authorised admin scope. |
| ~~Notification settings~~ **(now wired)** | `GET/PATCH /notifications/prefs`, `POST /devices/token` | The settings screen now reads and writes the API. Required security/money events cannot be silently disabled; optional categories are appointments, orders, chat, marketing. See [`PUSH_NOTIFICATIONS_CONTRACT.md`](PUSH_NOTIFICATIONS_CONTRACT.md). |
| Account data rights | deletion cancellation, data export, consent withdrawal | Required by the PRD privacy requirement but not yet exposed in frontend API methods. |

## 7. Decisions needed before the next API increment

1. ~~**Payment gateway:** select Paystack, Flutterwave, Stripe, or another provider~~ — **resolved: Monnify.** The native SDK, provider, and intent lifecycle are implemented client-side; see [`PAYMENTS_MONNIFY_CONTRACT.md`](PAYMENTS_MONNIFY_CONTRACT.md) for the endpoints, webhook signature handling, and the two decisions still open (intent currency, and whether saved cards are needed).
2. **Video provider:** select the SFU and the shape/TTL of backend-issued room tokens, recording storage, moderation, and consent withdrawal.
3. **OTP provider and rules:** confirm SMS/WhatsApp/email provider, code length (the implemented UI is five digits), expiry, resend and lockout policy. Membership linking must bind OTP to the target Crux ID and verified contact.
4. **Sanctum token lifecycle:** define token expiry/rotation and per-device revocation. If refresh is required, add a frontend endpoint before enforcing a short access-token TTL.
5. **Finance rules and compliance:** confirm currency/accounting treatment, payout bank verification, KYC, commitment legal disclosures, interest/fee rounding, settlement schedules, and the exact 5% “minimum” calculation. The mobile app must call existing shared finance logic rather than replicate rules.
6. **Rank ambiguities:** Bronze and Silver earnings are not defined; some higher-tier sub-level prerequisites (“Crux II/5/6”) are also undefined. Return transparent requirements, not invented values.
7. **Care authorization:** finalise when an assigned therapist gains and loses health-profile/case-file access, including post-session retention and client consent withdrawal.

## 8. Recommended Laravel delivery order

1. `/api/v1` baseline, Sanctum device tokens, user resource, RBAC/policies, common errors, cursor pagination, audit logging, and CORS for Capacitor/Web builds.
2. Auth/account/OTP/recovery plus `GET/PATCH /me` and membership/therapist activation.
3. Catalog, cart, checkout quote, orders and the Monnify payment adapter (`/payments/intents` + webhook).
4. Therapists, appointments, health profile, case files, chat REST endpoints; then Echo/Reverb and attachments.
5. Wallet/ledger and the reusable server quote → step-up → idempotent action pattern.
6. Finance/network/rank modules, then Point Facility and admin queues. (Push preferences and device registration are contract-ready now — see the push note — and only need a Firebase project to be testable.)

## 9. Contract source of truth in this repository

The immediate TypeScript contract is in `src/api/`, `src/types/`, and `src/mocks/handlers.ts`; frontend tests use that mock contract. Product/business constraints are in `design_handoff_cruxcare_mobile/reference/PRD-clean.md`, while the screen behaviour and UI-state requirements are in `design_handoff_cruxcare_mobile/reference/DesignScope-clean.md` and `design_handoff_cruxcare_mobile/README.md`.

Before Laravel implementation begins, publish the agreed `/api/v1` OpenAPI document and generate or validate the TypeScript API models against it. Any intentional API divergence should be agreed with frontend first, especially response envelopes, money values, pagination, idempotency, and the `User` shape.
