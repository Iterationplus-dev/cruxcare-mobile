<!--
  VENDORED COPY — do not edit here.

  Taken from cci/docs/ at 9c4fca4bad7aeb1efb51c88993374a6fd97a9f13
  (9c4fca4, "Backend for the mobile team's contract notes", 8 September 2026).

  cci/docs/ is canonical, agreed 8 September 2026 (N1.1). Changes belong there;
  re-vendor this file and update the SHA above rather than editing it, so a stale
  copy is visible instead of silent.
-->
# Payments — Monnify SDK integration and backend contract

**Audience:** Senior Laravel engineer
**Companion to:** `docs/FRONTEND_API_HANDOFF.md` (this answers its §7 decision 1, "Payment gateway")
**Status:** Mobile SDK and client wiring complete as of 18 August 2026. Three endpoints plus webhook handling remain on the Laravel side.

---

## 1. What was built

A Capacitor plugin wrapping Monnify's own checkout SDK, plus the provider and API client that drive it.

```
packages/capacitor-monnify/          # the SDK itself
  src/definitions.ts                 # typed bridge surface
  src/index.ts                       # registerPlugin, lazy web fallback
  src/web.ts                         # Monnify Web SDK (browser / npm run dev)
  android/                           # com.cruxcintl.monnify.MonnifyPlugin (Java)

src/services/payment/
  PaymentProvider.ts                 # provider-agnostic interface + mock
  MonnifyPaymentProvider.ts          # Monnify implementation
  index.ts                           # env-driven provider selection
src/api/payments.api.ts              # intent / confirm / poll
src/types/payments.ts                # wire types
```

It lives in `packages/` rather than `android/` deliberately: `android/*` is git-ignored (see `.gitignore`), so native source placed there would not survive a clone.

**Verified, not assumed.** The Android bridge was written against the actual published artifact — `com.monnify.android-sdk:monnify-android-sdk:1.1.8` from Maven Central, whose Kotlin package is `com.teamapt.monnify.sdk` (*not* `com.monnify.android_sdk`, which several third-party guides claim). The plugin module compiles against it.

### Native integration details worth knowing

- **JitPack is required.** Two of the Monnify SDK's transitive dependencies (`com.github.MasayukiSuda:BubbleLayout`, `com.github.NaikSoftware:StompProtocolAndroid`) are published only on JitPack. Without that repository the Gradle sync fails to resolve. Added in both the plugin module and — via `scripts/patch-android-push-and-monnify.mjs` — the generated root `build.gradle`.
- **Manifest merger conflict.** Monnify's AAR declares `android:theme` on `<application>`; the app declares its own. Two values for one attribute is a merger *failure*, not a silent win. The patch script adds `tools:replace="android:theme"`.
- **Activity-result path.** Monnify calls `startActivityForResult` itself, so the plugin uses Capacitor's legacy `@CapacitorPlugin(requestCodes = …)` + `handleOnActivityResult` route — the one Capacitor documents for exactly this case — rather than the AndroidX Activity Result API.
- A concurrent second `charge()` is rejected rather than queued; two overlapping sheets could double-charge.

---

## 2. The flow

```
app                          CruxCare API                    Monnify
 |  POST /payments/intents  ->  price it, mint reference
 |  <- { reference, amount, gateway }
 |
 |  Monnify.charge(reference, amount)  ------------------->  checkout sheet
 |  <- { status, transactionReference } <-------------------
 |                                              (webhook) <- transaction completed
 |  POST /payments/intents/{ref}/confirm  ->  verify with Monnify, settle
 |  <- { status: settled | pending | failed }
```

**The device is never the authority.** `MonnifyChargeResult.status` is what the sheet happened to report before it closed; it is a UI hint only. Two independent paths tell the server what really happened — its own verification call and Monnify's webhook — and the app trusts neither its own SDK result nor its own arithmetic.

---

## 3. Endpoints to build

Auth, error envelope, and idempotency semantics are per `FRONTEND_API_HANDOFF.md` §1–2. Amounts are **major units as JSON numbers** with a three-letter `currency`, matching `MoneyQuote` and the rest of the API.

### 3.1 `POST /payments/intents`

```jsonc
// Request  (carries Idempotency-Key)
{
  "purpose": "therapist-plan",   // "therapist-plan" | "order" | "wallet-topup"
  "subject": "monthly",          // plan tier, checkout-quote id, or order id
  "expectedAmount": 15,          // what the app currently shows
  "expectedCurrency": "USD"
}
```

```jsonc
// Response 201
{
  "reference": "CCPAY-…",        // merchant reference; Monnify echoes it on the webhook
  "amount": 15,
  "currency": "USD",
  "description": "CruxCare monthly plan",
  "customerName": "Amaka Obi",
  "customerEmail": "amaka@cruxcare.app",
  "gateway": {                    // may be null - see below
    "provider": "monnify",
    "apiKey": "MK_TEST_…",
    "contractCode": "1234567890",
    "mode": "TEST"
  },
  "expiresAt": "2026-08-18T12:30:00.000Z"
}
```

**Required behaviour**

- **The server prices `subject`.** `expectedAmount` exists only so a stale quote can be rejected — `422` with `code: "stale_quote"` on a mismatch. Never charge the client-supplied figure.
- `422` with `code: "unpayable_subject"` when the subject costs nothing or is not payable by this user (e.g. the free trial tier).
- Persist the intent with its own reference before returning. The webhook may arrive **before** the app's confirm call — sometimes before the sheet has even closed.
- Replay the same intent for a repeated `Idempotency-Key` rather than minting a second reference.

**On the `gateway` block:** serving merchant credentials from the API means keys and TEST/LIVE rotate without an app release, and a compromised key is revocable server-side. `apiKey` and `contractCode` are *public* merchant identifiers — this is not a secret being leaked. The Monnify **secret key** stays server-side and is used only for `auth/login` and verification. Returning `null` makes the app fall back to its build-time `VITE_MONNIFY_*` values; that fallback exists for local development and should not be relied on in production.

### 3.2 `POST /payments/intents/{reference}/confirm`

```jsonc
// Request  (carries Idempotency-Key)
{ "gatewayReference": "MNFY|…|…" }   // may be null when the sheet gave none
```

```jsonc
// Response 200
{
  "reference": "CCPAY-…",
  "status": "settled",        // "settled" | "pending" | "failed" | "cancelled"
  "message": "Payment confirmed.",   // shown to the customer verbatim
  "amountPaid": 15,
  "currency": "USD",
  "settledAt": "2026-08-18T12:04:11.000Z"
}
```

**Required behaviour**

- `gatewayReference` is a **hint that lets you verify now instead of waiting for the webhook. It is not evidence.** Re-verify with Monnify server-side before settling anything. A client that could settle a payment by naming a reference is a client that can mint money.
- Verify the amount too. `amountPaid < totalPayable` is `PARTIALLY_PAID`, not a success, however the sheet reported it.
- `status: "pending"` is the honest answer while verification is outstanding — bank transfers routinely land minutes later. The app never presents `pending` as success.
- `404` for a reference belonging to another user.

### 3.3 `GET /payments/intents/{reference}`

Same response body. Polled while an intent sits `pending`. Scope to the caller.

### 3.4 `POST /me/therapist/activate` — one change

This endpoint already exists and already returns `202 { status: "pending_payment", … }` for a gateway payment. The only change: **`paymentToken` now carries a payment-intent `reference`** (`CCPAY-…`) when the user paid by card, alongside the existing `"wallet"` sentinel. Resolve the intent, check its settlement, and activate only when it is settled — otherwise keep returning `202`. The mobile client is already written against exactly this behaviour.

---

## 4. Monnify server-side

Values below should be checked against Monnify's current API reference before implementation; the SDK-side details in §1 were verified against the shipped artifact, these were not.

- **Auth:** `POST {base}/api/v1/auth/login` with `Authorization: Basic base64(apiKey:secretKey)` → a bearer token with a TTL. Cache it; do not re-authenticate per request.
- **Base URLs:** sandbox `https://sandbox.monnify.com`, live `https://api.monnify.com`.
- **Verification:** by Monnify's `transactionReference`, or by your own `paymentReference`. The authoritative fields are `paymentStatus`, `amountPaid`, `totalPayable`, `settlementAmount`, `paymentMethod`. `paymentStatus` values: `PAID`, `PARTIALLY_PAID`, `PENDING`, `OVERPAID`, `FAILED`, `REVERSED`, `EXPIRED`.

### Webhook

Monnify signs each notification with a `monnify-signature` header: **SHA-512 of (client secret key + raw request body)**.

- Compute over the **raw body**, before any JSON decode/re-encode. Re-serializing changes the bytes and every signature check fails.
- Reject on mismatch. Optionally also whitelist Monnify's IPs.
- **Acknowledge with `200` first, then process.** Monnify retries on timeout, and slow processing turns into duplicate deliveries.
- **De-duplicate on `transactionReference`.** Retries and the app's own confirm call will both arrive.
- The webhook and `confirm` race by design. Make settlement idempotent — whichever arrives first settles, the second is a no-op.

---

## 5. Configuration

```bash
VITE_PAYMENT_PROVIDER=monnify     # anything else keeps the always-approving mock
VITE_MONNIFY_API_KEY=MK_TEST_…    # public merchant id; fallback only
VITE_MONNIFY_CONTRACT_CODE=…      # public; fallback only
VITE_MONNIFY_MODE=TEST            # only the literal LIVE moves real money
```

`VITE_*` values are **inlined into the shipped JavaScript bundle**. The Monnify secret key must never appear in one. Mode defaults to `TEST` on anything unset or misspelled, so a typo cannot start taking live payments.

`VITE_PAYMENT_PROVIDER` unset leaves `MockPaymentProvider`, which approves every payment. It must never be used against a real API.

---

## 6. Currency

The plan screen prices in USD; Monnify is NGN-first and its contracts are usually NGN-denominated. **This needs a decision before go-live**: either the server issues intents in NGN (converting at a rate it owns, and the plan screen shows NGN), or the Monnify contract is configured for USD. The app forwards whatever currency the intent carries and does no conversion, so this is a backend/commercial decision, not a client change.

---

## 7. Known limitations

- **Android and web only.** There is no `ios/` directory in this repo. `packages/capacitor-monnify` has no iOS implementation; adding one means wrapping Monnify's iOS SDK behind the same `definitions.ts`.
- **No saved cards.** Monnify's checkout SDK charges one transaction and has no vaulting flow, so `MonnifyPaymentProvider` deliberately omits `collectPaymentMethod`. `PaymentMethodsScreen` detects its absence and says so rather than offering a card that could never be charged again. Recurring billing would need Monnify's reserved-account or recurring-card product and a separate contract.
- **Checkout still pays by wallet only.** `CheckoutScreen` offers no card option; adding one means opening an intent with `purpose: "order"` exactly as `TherapistPlanScreen` does.
- **The web fallback is for development.** It drives Monnify's hosted modal so `npm run dev` exercises the same provider path, and loads `sdk.monnify.com` at runtime.
