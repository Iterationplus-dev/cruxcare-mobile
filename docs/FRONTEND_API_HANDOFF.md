# CruxCare Mobile — Frontend API Handoff for Laravel

**Audience:** Senior Laravel engineer

**Status:** Frontend contract audit as of 12 August 2026, amended 18 and 28 August 2026 and 4 September 2026. The mobile app has a working mock API layer for the Phase 0/1 surface. It is ready to switch to Laravel once the contracts below are available.

> **Amended 4 September 2026 (frontend).** Two defects and one missing endpoint found running an Android build against `cruxcare_dev` are written up in the new **[§10](#10-observed-on-device--two-defects-and-one-missing-endpoint-4-september-2026)**: `PATCH /appointments/{id}` 500s on a missing `therapist_ratings` table, the API is returning raw exception text as the user-facing `message`, and the log-out sheet needs a single call that ends every other session.
>
> **Amended 28 August 2026 (backend).** The frontend revision of this note was written before the therapist care-request work landed, and marked those three routes "not built yet". They are built, tested, and now carry `caseFileId`. Their rows below and the note in §4.3 have been corrected in place. `gender` is built as specified. `GET`/`PATCH /me/therapist/profile` remain genuinely outstanding — see the note in §4.3.
>
> **Amended 28 August 2026 (frontend, replying).** Answers to the two questions the backend raised, and what the client now does about the empty case file, are in §4.3 under "Frontend answers".

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
  "gender": "female",
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

`gender` is nullable and may be absent entirely on accounts created before the field existed; the mobile client treats absent and `null` alike and shows an unselected dropdown. It records self-described identity for the profile, not clinical sex-at-birth — anything care decisions depend on belongs to the health profile and is collected there.

**Built 28 August 2026, with two caveats about existing accounts.** The key is always emitted, `null` included, so it is never absent and the mobile type can be tightened from optional to required-with-null. But registration still writes the platform default (`Male`), so an account that has never opened the Personal information screen reads back as `"male"` rather than `null` — the dropdown opens pre-filled, and members correct it themselves. And because the underlying column is shared with the older web profile form, a value it holds that is not one of the four reads back as `null` rather than as something the app has no label for. It is returned only to the signed-in member: it is not in the therapist directory or the therapist-facing client projection.

**Frontend response.** The type stays optional-and-nullable rather than required-with-null — it costs nothing and keeps the client safe if any future endpoint omits the key. The pre-filled dropdown is the part worth revisiting: see "Frontend answers" in §4.3 for what the client now does about it and why the registration default should become `null`.

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
| `PATCH /me` | Any of `firstName`, `lastName`, `gender`, `avatarUrl`, `payoutAccount` | Updated `User`. Do not allow arbitrary fields/roles to be mass assigned. Valid gender values: `female`, `male`, `non-binary`, `prefer-not-to-say`; `null` clears it. Reject anything else with `422` + `errors.gender` rather than storing it. |
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
| `GET /me/therapist/profile` | — | **Not built yet.** The caller's own `TherapistSummary` — the same record clients read at `GET /therapists/{id}`. Resolve the therapist from the session; the app never sends a therapist id. `403` for an account with no therapist profile. |
| `PATCH /me/therapist/profile` | `{ specialties: string[] }` | **Not built yet.** Updated `TherapistSummary`. The list replaces what is stored — it is not a merge, and `[]` legitimately clears it. Normalize each entry (trim, collapse inner whitespace) before storing, so what clients read matches what was typed. Reject with `422` + `errors.specialties` when: any entry is blank after trimming, any entry exceeds 40 characters, two entries match case-insensitively, or the list exceeds 8 entries. A rejected update must leave the stored list untouched. `403` for an account with no therapist profile. Only `specialties` is sent today; keep the route shaped for `bio`, `languages` and `experienceYears` later. |
| `POST /care/requests` | `{ reason, therapistId? }` | Create care/therapist assignment request; return `201/202` with `therapistId`. A named therapist is attached to the case and notified so it reaches their queue; without one the request stays open. Final assignment remains a staff workflow either way. `422 therapist_unavailable` if the id is not a bookable therapist. Returns the full `CareRequest` (see `GET /care/requests`) so the client can show it immediately. `status` vocabulary: `submitted`, `in-review`, `accepted`, `declined`, `cancelled`, `closed`; an unknown value is rendered with a neutral "in progress" treatment rather than rejected. A request naming a therapist opens at `in-review` (someone has it); an unnamed one opens at `submitted` (nobody has looked yet). Creation always writes one event, so a fresh request never returns `events: []`. |
| `GET /care/requests` | `cursor?` | Cursor page of the **caller's own** `CareRequest`, newest first: `id`, `reference`, `status`, `reason`, `therapistId`, `therapistName`, `therapistAvatarUrl`, `createdAt`, `updatedAt`, `events[]`. `events` is the progress trail the client screen renders — `{ id, status, label, note?, at }`, oldest first, one entry per real step. The app never invents a step, so a request with no recorded progress must return an empty array rather than a synthesised one. |
| `GET /care/requests/{id}` | — | One `CareRequest`. Scope to the owning client. |
| `POST /care/requests/{id}/cancel` | — | Updated `CareRequest` with `status: "cancelled"` and an appended event. `422 request_not_cancellable` once the request is `accepted`, `closed`, or already `cancelled` — carrying `meta.status` with the true state, which the client re-renders from rather than trusting its own copy. Accepts the `id` or the `reference`. Someone else's request is a `404`, never a `403`, which would confirm it exists. |
| `GET /therapist/care-requests` | `cursor?` | **Built.** Cursor page of the caller's incoming `TherapistCareRequest`, newest first: `id`, `reference`, `status`, `reason`, `clientId`, `clientName`, `clientAvatarUrl`, `caseFileId`, `createdAt`, `updatedAt`, `events[]`. `caseFileId` is the id of the case file opened for this client, or `null` while there is none — it is a **case file** id, not the client's, and the app routes straight to `GET /case-files/{caseFileId}` with it. Sending a client id here renders a blank screen. Same underlying record as the client's `CareRequest` and the same `events` trail — it carries the **client** instead of the therapist, because that is the identity being decided about. Scope server-side to requests whose `therapistId` is the caller's own therapist profile; the app never sends a therapist id. A caller with no therapist profile gets an empty page, not a `403`. Requests with no named therapist never appear here — nobody was asked. |
| `POST /therapist/care-requests/{id}/accept` | — | **Built, including the case file.** Updated `TherapistCareRequest` with `status: "accepted"` and an appended event, written for the client who reads the same trail. Creates the working relationship — case file, chat thread, and whatever else assignment implies. **The case file must exist before this call returns**, and the returned record must carry its id as `caseFileId`: the therapist screen offers "Open case file" the moment a request reads `accepted`, so an acceptance without one leaves a dead end. Re-accepting an already-accepted client must reuse the existing case file rather than opening a second. `422 request_not_actionable` unless the request is `submitted` or `in-review`, carrying `meta.status` with the true state, which the app re-renders from rather than trusting its own copy. `422 therapist_plan_required` when the therapist has no active plan or is at their client limit: the app disables the button, but the limit is a server rule and must be enforced here. Someone else's request is a `404`, never a `403`. Must be idempotent enough that a double tap does not assign twice. |
| `POST /therapist/care-requests/{id}/decline` | — | **Built.** Updated `TherapistCareRequest` with `status: "declined"` and an appended event; notify the client so staff can re-match. Same `404`/`422 request_not_actionable` rules as accept. **Not** gated by the plan — passing on a case consumes no client slot. Opens no case file; `caseFileId` stays `null`. |
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

#### The therapist's side of a care request — built 24 August 2026, case file added 28 August

`POST /care/requests` says a named therapist "is attached to the case and notified so it reaches their queue". Until this work there **was no queue to reach**: the only read route was `GET /care/requests`, scoped to *the caller's own* requests as a client, so a therapist calling it got the requests they sent, never the ones sent to them. A client could name a therapist and the request would sit in the database unseen. The Appointments screen was never it — an `Appointment` is a separate record with its own `requested` status, and nothing converts a `CareRequest` into one.

The three routes above now exist and are what the mobile side already calls:

- `src/api/care-queue.api.ts` — `careQueueApi.list/accept/decline`
- `src/composables/useTherapistCareRequests.ts`
- `src/features/therapist/screens/TherapistCareRequestsScreen.vue` at `/therapist/care-requests`, with a waiting-requests banner on the therapist's Today dashboard

Server-side they are one more projection of the same `cases` row, not a new entity — `CareService::incomingRequestsFor()` is the mirror of `requestsFor()`, scoped by `therapist_id` where the client's is scoped by `patient_id`.

How the requirements were met:

1. **Scoped by the caller's therapist profile, server-side.** Neither the list nor the two actions accept a therapist id; every query starts from the authenticated user's own. A caller who is not a therapist owns no rows and gets an empty page, not a `403`.
2. **The plan and client limits are enforced on `accept`.** The gate reads `config('cruxcare.therapist.limits.{slug}.clients')` — the same configuration the directory's `fullyBooked` flag uses — and runs inside the row lock alongside the status re-check, so two taps cannot both consume the same last slot. `decline` is not gated.
3. **The event is written for the client.** `"{therapistName} accepted your request"`, never "you accepted" — both sides render the same `events[]`, and a test asserts the client's `GET /care/requests/{id}` returns an identical trail.
4. **`caseFileId`, and the file exists before `accept` returns.** Opened inside the same transaction and row lock as the status change, so a double tap cannot open two files; re-accepting returns the id of the first. `decline` opens none and leaves it `null`.

Three judgment calls worth knowing about:

- **The case file opens empty, and the table changed to allow it.** `case_files` was built for the web workflow, where a file is written *after* a consultation: `diagnosis`, the treatment window, `package_plan_id` and `medication_total` were all `NOT NULL`. A therapist who has just accepted a request has none of them. Rather than fill the row with placeholder text that would read as real clinical data on the staff case file, those columns are now nullable and the new file carries only `case_id` and `created_by`. `GET /case-files/{id}` returns `diagnosis: null` and a null treatment window until the therapist writes one.
- **Slots count accepted engagements, not open cases.** The directory's existing `atClientCapacity()` counts every open case including pending requests, which is right for `fullyBooked` — someone whose only free-trial slot is already spoken for should not be shown as open. Applying it at accept time would have been wrong: the request being decided *is* an open case on that therapist, so a free-trial therapist could never have accepted their first client. The accept gate therefore counts `Active` cases and excludes the one being decided.
- **A second tap on `accept` returns `200`, not `422`.** The contract asks for `422 request_not_actionable` on anything past `submitted`/`in-review`, and separately that a double tap "does not assign twice". Both hold for another therapist's or another state's request. But when *the same therapist* re-accepts a request they already accepted, the outcome is identical to the first call, so it returns the record rather than an error for something that worked. The row lock is what prevents the double assignment; only one `accepted` event is ever written, and only one case file.

The adjacent issues, resolved:

- **The notification deep-link.** Worse than a wrong route: `PushDispatcher` stores the deep link under the data key `route`, while `GET /notifications` read `action_route`, so **every** notification in the inbox returned `actionRoute: null` — the push payload deep-linked correctly, the in-app list never did. The transform now reads `route` (falling back to `action_route` for older rows), and the therapist's "New client request" carries `/therapist/care-requests` plus an action label.
- **`GET /notifications` is already per-recipient.** `NotificationController` filters on `user_id` for both read and update. That was purely an MSW artifact; nothing to change.

**Still needed from the frontend:** the client-side route name for the tracking screen. The accept and decline notifications sent to the *client* deliberately carry no `actionRoute` — a wrong path is worse than an untappable notification. Send the route and they become tappable. — *Answered below.*

#### Still outstanding — the therapist's own profile

`GET`/`PATCH /me/therapist/profile` are **not built**, and unlike the queue they are not a projection of something that already exists. `specialties` is currently a single string — `users.specialization` — wrapped in a one-element array by `TherapistResource`. Storing a real list of up to eight entries needs a schema decision (a JSON column, or a related table), and it cannot be a delimited string: the web registration flow and the staff case-file query both read that column as a plain value. The validation rules in the row above are understood and are not the hard part; the storage is. Flagging it rather than guessing, since it changes a column the web app shares.

#### Frontend answers — 28 August 2026

**The client tracking screen is `/care/requests`** (route name `care-requests`). The accept and decline notifications sent to the *client* can carry `actionRoute: "/care/requests"`. The therapist's own queue is `/therapist/care-requests`, already in use.

**A second accept should return the record, not a `422`.** The backend's current behaviour is right and the mock has been changed to match: re-accepting a request you already accepted is not a failure, and the outcome is identical. `422 request_not_actionable` still applies to every other settled state — `declined`, `cancelled`, `closed` — and another therapist's request stays a `404`. The mobile test now asserts idempotence in substance: same `caseFileId`, and exactly one `accepted` event on the client's trail.

**The empty case file is handled.** `diagnosis`, `treatmentStartDate` and `treatmentEndDate` returning `null` now render as "Not recorded yet" / "Not set yet" in muted text rather than a blank line, and a file with no `clientName` or `sessionCount` no longer renders an empty title or "undefined session(s)". The mobile `CaseFile` type treats all of those as optional-and-nullable, so the nullable columns are safe to ship.

**On `specialties` being one string column:** the read half alone does unblock the screen, but it cannot be saved — shipping read-only would put a Save button on a screen that always fails. Prefer holding the whole route until the storage decision is made. The mobile side is built and waiting either way; nothing else is blocked on it.

**The Clients list means sessions *sat*, not booked.** Counting completed appointments only is the right rule and the screen means exactly that. The subtitle sits next to a client the therapist is about to open, so a count inflated by cancellations and no-shows would misrepresent the relationship before they read a word of it. No second field needed.

**Yes, the client always sends `specialties`.** There is one call site and it always passes the key; since an omitted key is a `422` rather than a clear, the parameter is now typed as required rather than optional so a future caller cannot omit it by accident. `[]` remains how the list is cleared.

**On cases 13 and 14 — active with no `therapist_id`.** Nothing on the mobile side can produce that state, so the trace starts elsewhere. `POST /care/requests` without a `therapistId` creates an *unassigned* request that opens at `submitted` and stays there; the only thing that activates a case is `accept`, which is scoped to a therapist and cannot run without one. Both cases also date from March 2026, months before the care-request queue existed. They came from the older web workflow.

**On the gender default.** Registration writing `"male"` means every account that has never opened Personal information reads back a gender its owner never stated, and the dropdown opens pre-filled with it. The client no longer launders that into an answer — `gender` is sent **only when the member changes it**, so saving an unrelated field leaves the stored value untouched. That covers the client's half, but the stored data is still an assertion nobody made. Recommend changing the registration default to `null`: "not stated" is a fact, `"male"` is a guess, and every downstream reader of that column currently cannot tell them apart.

```json
{
  "id": "care-req-1042",
  "reference": "CR-1755000000000",
  "status": "in-review",
  "reason": "Amaka Obi would like to work with Chidi Nwosu.",
  "clientId": "user-123",
  "clientName": "Amaka Obi",
  "clientAvatarUrl": null,
  "caseFileId": null,
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

## 10. Observed on device — two defects and one missing endpoint (4 September 2026)

> **Answered 4 September 2026 (backend).** All three are closed on their side. 10.1 was four pending migrations in `cruxcare_dev`, `therapist_ratings` among them — the write path was never at fault. 10.2 is fixed harder than asked: the debug branch is gone from the error handler entirely, so 5xx returns fixed copy in every environment and carries an `errorId` in `meta` and on `X-Error-Id`. 10.3 shipped as `POST /auth/logout` with `{ "allDevices": true }` → `204`.
>
> **Frontend, replying.** The app now sends the flag instead of looping `DELETE /me/devices/{id}` (`src/api/auth.api.ts`, `src/features/profile/components/LogoutSheet.vue`); the abort-on-partial-failure path is gone with it. `ApiError` keeps sanitising — a seatbelt that never has to fire. Two items are back with us and are tracked in §11.


Found against `cruxcare_dev` on an Android build pointed at the live API, not at the mocks.

### 10.1 `PATCH /appointments/{id}` fails with a missing table

A therapist accepting a booking request (`PATCH /api/v1/appointments/25` with `{ "status": "confirmed" }`) returns a 500:

```text
SQLSTATE[42S02]: Base table or view not found: 1146
Table 'cruxcare_dev.therapist_ratings' doesn't exist
(Connection: mysql, Host: 127.0.0.1, Port: 3306, Database: cruxcare_dev,
 SQL: select `score` from `therapist_ratings` where `appointment_id` = 25 and `client_id` = 1281 limit 1)
```

The write itself looks fine — the failure is a `score` lookup that runs while the appointment is being serialised, against a table that does not exist in the schema. Accepting and declining are therefore both blocked; the therapist sees an error and the request stays in the Requests tab.

Two things to settle:

1. **The migration is missing from this environment.** Either `therapist_ratings` was never migrated or the code shipped ahead of it. Confirm which, and make the appointment resource resilient to the table being empty (a client who has not rated has no row — that must be `null`, not an exception).
2. **The mobile contract does not have this field.** The `Appointment` shape the app consumes (§3 and `src/types/care.ts`) is `id, clientId, clientName, therapistId, therapistName, slot, type, status, reason, cancellationCutoff`. There is no `rating` or `score` on it, and the app does not read one. Rating lives on `Therapist.rating`/`ratingCount` only. So the per-appointment lookup is work the mobile client never asked for — if it is not needed by another consumer, take it out of the appointment resource rather than adding a table for it. If it *is* going into the contract, propose the field name and shape first.

### 10.2 Raw exception text is being returned as `message`

The block above is the literal `message` the API sent, and the app rendered it verbatim to the user in an error sheet. Per §2, an error body is `{ message, code?, errors?, meta? }` and `message` is user-facing copy. A stack trace, a SQL statement, the schema name, and the DB host and port are none of those things — this is `APP_DEBUG=true` leaking through the JSON error handler.

Required:

- `APP_DEBUG=false` in every environment a mobile build can reach, `cruxcare_dev` included. Debug detail belongs in the logs.
- 5xx responses return a fixed, human `message`. Put the correlating identifier in `code` or `meta` if you want the user able to quote something back to support.
- Never include SQL, class names, file paths, or connection details in any field the client renders.

The frontend no longer trusts this: `ApiError` now sanitises server text before any screen shows it (`src/utils/errorMessage.ts`), keeping the original on `error.detail` for dev logs. That is a seatbelt, not a fix — the API must stop sending it.

### 10.3 Wanted: one call that ends every other session

AM4 (log out confirmation) now offers **"Log out of all devices"**, shown when `GET /me/devices` reports more than the current one. There is no endpoint for it, so the client currently loops `DELETE /me/devices/{id}` over each device where `current` is false and only then calls `POST /auth/logout`. That is N round-trips and it is not atomic — a failure halfway leaves some sessions alive, so the app aborts the logout and tells the user nothing was changed.

Please add one of:

- `POST /auth/logout` accepting `{ "allDevices": true }`, or
- `DELETE /me/devices` (revoke all but the caller, then the caller).

Either way it should revoke the Sanctum tokens **and** the matching push registrations from `PUSH_NOTIFICATIONS_CONTRACT.md` in the same transaction, and return `204`. This also depends on `GET /me/devices` setting `current` correctly for the calling token — the count in the sheet reads "N other sessions active" straight off it.

Related: §7.4 (Sanctum token lifecycle) still lists per-device revocation as undecided. This is the concrete ask from that item.

## 11. Open with the frontend, from the backend's reply to §10 (4 September 2026)

### 11.1 `Appointment.myRating` — proposed, not agreed

`canRate` has been withdrawn: the rule it duplicated is already enforced at `POST /appointments/{id}/rating`, which refuses with `422 session_not_rateable`. Agreed — a second copy of a rule is a second thing that can drift.

`myRating` (integer 1–5 or `null`, always `null` in a therapist's copy) is still being returned and is recorded on their side as proposed. It buys one thing: a client who has already rated sees their own stars instead of an empty prompt.

**Frontend position:** the app does not read it today, and the rating sheet is a separate screen that can fetch what it needs when it opens. Unless another consumer wants it, take it out and leave `Appointment` at the ten fields in §4.3 — that keeps the resource matching the contract exactly, which is the thing §10.1 was really about. Happy to be overruled if the extra round trip is the worse trade; if it stays, it goes into §4.3 as agreed rather than proposed.

One correction accepted from their reply: `therapist_ratings` itself is not a stray table — it is what fills `TherapistSummary.rating` and `ratingCount`, which §4.3 already promises and the profile screen already reads. §10.1's second point was about the appointment-level fields only.

### 11.2 Signing out one device leaves its push registration alive — built, and wired

> **Built 5 September 2026 (backend), wired same day (frontend).** The installation is recorded on the token at issue time, as asked. The client now sends `X-Installation-Id` on the two calls it makes that mint a token, and the pre-logout `DELETE /devices/token/{installationId}` is gone.

**Only two of the four routes exist in this client.** `POST /auth/register` and `POST /auth/login` both send the header. There is no `/auth/login/verify` in the mobile app — two-factor is a `POST /auth/two-factor` preference toggle, not a login challenge — so nothing sends it there. If a 2FA login challenge is added later, the header goes on it at the same time.

The id is the same value already upserted at `POST /devices/token`, now read from `src/services/installationId.ts` rather than living inside the push service — two callers need it, and it was never really a push concern. It is sent on those two routes only, not on every request: it is a label, not a credential, and there is a test pinning that it stays off everything else.

Sessions that predate this keep their old behaviour, as described — noted for whoever tests it, since the fix will not appear on a session that is already open.



`DELETE /me/devices/{id}` revokes that session's token but cannot drop the matching push registration, because nothing links a token id to an installation. The handset loses API access and keeps receiving notifications — the exact failure §10.3 was about, one route over. It is reachable from PR4's Active devices screen, so it is a real path, not a theoretical one.

Their two options were: the client sends its `installationId` alongside, or the installation is recorded on the token at issue time and matched server-side.

**Frontend position: the second.** The client can only send the `installationId` of the handset it is running on, and the whole point of that screen is signing out a device you are *not* holding — so the client-side option cannot fix the case that matters. Recording the installation on the token at issue time is the only version that works for a remote sign-out. It is a schema change; please spec it.

## 12. Frontend answers to the §11.2 build note (5 September 2026)

| Their item | State |
| --- | --- |
| Send the installation id at sign-in | **Done** — `X-Installation-Id` on register and login; no `/auth/login/verify` exists here |
| Show `errorId` in the error sheet | **Done** — read from `meta.errorId` and the `X-Error-Id` header |
| Drop the pre-logout `DELETE /devices/token/{id}` | **Done** — the local FCM teardown stays, the network call is gone |
| Remove `canRate` / `myRating` | **Nothing to remove** — neither field was ever declared in `src/types/care.ts` or the MSW handlers |
| Two handsets no longer evict each other | Understood; no client test relied on the old eviction |
| Shared handsets stop push per account | Understood and correct — the registration belongs to the person signing out |

### 12.1 The error reference is shown, not just captured

`ApiError` now carries `reference`, taken from `meta.errorId` or the `X-Error-Id` header, whichever arrives. `useToast().show()` accepts the `ApiError` itself rather than its message, so the feedback sheet renders the sanitised copy plus a selectable "Quote reference" line beneath it. Every error surface in the app was converted, so a 5xx shows the id wherever it happens rather than only where someone remembered to thread it through.

The header is genuinely the more useful half: it survives a body the interceptor could not parse, which is the case that produced §10.2 in the first place.

### 12.2 One thing we would still take

`GET /me/devices` echoing the installation id back is **not** needed — agreed, and we are not asking for it. What would help instead is the device row telling us which entry is *this installation* rather than only which is the current *token*. They are the same today; they stop being the same the moment a session is reissued on the same handset, and Active devices would then show "this device" against a row the user did not expect. Not urgent, and not worth a schema change on its own — worth knowing before someone builds session refresh.

## 13. Frontend answers to the §12 build guide (5 September 2026)

| Their item | State |
| --- | --- |
| 1 · Video call screen | **Wired against the contract.** Token, join, refresh, leave, host-only end. One gap: the Daily client SDK — see §13.1 |
| 2 · Recording consent | **Built.** Read after joining, both-sides status, withdrawal warning, record button gated on `canRecord` |
| 3 · `withdrawal_threshold_not_met` | **Handled** on quote *and* settlement, with both figures and the server's currency |
| 4 · Lapsed plan closes health-profile access | **Nothing to change today** — see §13.3 |
| 5 · OTP sender, `current`, ten-field Appointment | Understood; no client change, and nothing was pinned to a sender name |

### 13.1 The SDK named in the note is for the wrong stack

The guide says "on React Native that is `react-native-daily-js`". **This app is not React Native.** It is Ionic 8 + Vue 3 + Capacitor — the UI runs in a WebView, so the right package is `@daily-co/daily-js`, Daily's web SDK, which works inside a Capacitor WebView using the platform's own WebRTC. `react-native-daily-js` depends on `react-native-webrtc` and will not install or run here.

Nothing in the contract changes because of this — the same `url` and `token` are what the web SDK's `callObject.join({ url, token })` takes. Only the package name in the guide is wrong, and it is worth correcting before it reaches whoever writes the runbook.

**What is built, and what is not.** The screen is wired end to end against `videoProvider`, the interface the codebase already had for this: it asks for a token on open, joins, refreshes two minutes before `expiresAt`, reads consent after joining, and offers the host-only end control. What is still a stand-in is the single implementation behind that interface (`src/services/video/MockVideoProvider`), which is where `@daily-co/daily-js` goes. Adding a media SDK is a dependency decision plus native permission work (camera and microphone in `AndroidManifest.xml` and `Info.plist`), so it is deliberately not bundled into this pass. Everything else is done and testable against the mock API.

Two things we will need before that implementation can be written:

1. **The Daily domain per environment.** `url` comes back fully formed, so nothing needs configuring for joining — but confirm whether `cruxcare.daily.co` is the domain in every environment or only in `cruxcare_dev`.
2. **Who calls "start recording".** The guide gives consent endpoints but no start/stop route, so we have read it as an SDK operation the host token permits once both have agreed. The record button is gated on `canRecord` and calls the provider, not the API. Say if that is wrong.

### 13.2 Consent, as built

`GET` on join, `PUT` on the toggle, and the three fields used exactly as described: `mine` is the only control, `theirs` renders as a status line ("Waiting for the other person to agree. Nothing records until you both do."), and the record button is gated on `canRecord` rather than on `mine && theirs`.

Two details worth confirming back:

- **Consent is read after joining, not before.** Asking first would have made it a gate on the call, which is the bundling the note asks us to avoid. It is an explicit act inside the session it applies to.
- **The withdrawal copy says what actually happens**: "Turning this off stops the recording straight away. What was already recorded is kept." A user who taps it expecting the first ten minutes to vanish would have been misled, so the copy says otherwise before they tap.

The old screen hardcoded `recording = true` and a line reading "This session is being recorded with your consent." That was untrue in every state and is gone.

### 13.3 The lapsed-plan 404 has nothing to land on yet

There is no therapist-side health-profile read in this client. `healthProfileApi.get()` calls `GET /health-profile` with no `clientId` — it is the client reading their own, from Profile and the care hub. No therapist screen calls it.

So the suspension changes nothing in the app today. It is recorded here so that whoever builds the therapist-side view writes the renewal path with it: **suspended, not ended** — "Your plan has expired — renew to continue", never "This client has revoked access", which would be untrue and alarming. Case files staying readable on a lapse is noted too.

### 13.4 One pre-existing bug this surfaced

`ChatThreadScreen` opens the video route with a **thread id** where every other entry point passes an appointment id (`src/features/shared/screens/ChatThreadScreen.vue`). Against the mock provider that was harmless — it joined a room named after whatever it was given. Against a real token endpoint it is a 404, because there is no appointment with that id.

Left as-is rather than guessed at: resolving a thread to its appointment needs a rule about which appointment a thread belongs to, and that is a product question. Flagging it because the video work is what makes it break.

### 13.5 Wallet, as handled

`withdrawal_threshold_not_met` and `daily_limit_exceeded` both render their figures — "Your wallet needs to reach $500.00 before you can withdraw. You have $200.00." Currency comes from `meta.currency`, never assumed. Both codes are handled on `POST /wallet/quotes` and on `POST /wallet/actions`, since a quote is a price and not a permission.

Where the meta block is incomplete, the server's own `message` is shown instead of copy assembled from half a payload. The refusal logic is a pure function with tests (`src/features/wallet/moneyActionErrors.ts`), so the wording is checkable without driving the screen.

Before this, `MoneyActionScreen` caught every failure into one line — "We could not create a server quote. Check the amount and try again." — which is exactly the generic failure on a money screen the note warned about.

