# Push Notifications — Backend Contract Note

**Audience:** Senior Laravel engineer
**Companion to:** `docs/FRONTEND_API_HANDOFF.md` (this replaces the "not connected in current frontend code" caveat in its §4.5 and §6)
**Status:** Mobile client is wired end-to-end as of 18 August 2026. Four endpoints and the FCM payload contract below are what remain on the Laravel side.

---

## 1. What changed on the mobile side

Before this change `@capacitor/push-notifications` was installed and compiled into the Android app, but **nothing in the app ever called it**: no permission request, no `register()`, no listeners, no token upload. Push was, in practice, not integrated at all. It now is:

| Concern | Where it lives now |
| --- | --- |
| Permission request, registration, token capture | `src/services/push/pushNotifications.ts` |
| Token upload / device revocation client | `src/api/devices.api.ts` |
| Notification-preference client + composables | `src/api/devices.api.ts`, `src/composables/useNotifications.ts` |
| Session-linked enable/disable | `src/App.vue` (login), `src/stores/auth.ts` (logout) |
| Deep-link routing on tap | `openFromPayload()` in the push service |
| Android manifest, channel, icon, colour | `scripts/patch-android-push-and-monnify.mjs` |
| Wire-level types | `src/types/push.ts` |
| Tests | `tests/unit/services/push/pushNotifications.spec.ts` |

### Native defects that were fixed at the same time

These would each have broken delivery on a real device regardless of the API:

1. **`POST_NOTIFICATIONS` was not declared.** The app targets SDK 36; on Android 13+ an app without this permission is silently denied. The Capacitor plugin's own manifest does not contribute it.
2. **No notification channel.** Android filed every message under the fallback "Miscellaneous" channel at low importance, which the user cannot tune. A `cruxcare-default` channel is now created at importance 4 and declared as the FCM default.
3. **No notification icon or colour.** Firebase fell back to the launcher icon, which Android renders as a solid grey square on API 21+. A white silhouette (`ic_stat_cruxcare`) and the brand accent are now declared.
4. **`PushNotifications` had no `capacitor.config.ts` entry**, so a message arriving while the app was open displayed nothing.
5. **No unregister on sign-out** — the next person to use the handset would have kept receiving the previous user's notifications.

### Firebase project — client side is done

`android/app/google-services.json` is in place, so the `com.google.gms.google-services` Gradle plugin now applies and the FCM resources are generated at build time. The Android app is registered against:

| | |
| --- | --- |
| Project id | `cruxcare-mobile` |
| Project number / FCM sender id | `344764946716` |
| Android package | `com.cruxcintl.mobile` |
| Mobile SDK app id | `1:344764946716:android:24bcb787cc7becbf11c2d9` |

**Laravel needs a different file from the same project:** the **service account JSON** (Firebase console → Project settings → Service accounts → *Generate new private key*), used to mint the OAuth token for FCM HTTP v1 against `https://fcm.googleapis.com/v1/projects/cruxcare-mobile/messages:send`. That one is a genuine secret — server config only, never the repo, never the app.

> `google-services.json` itself is client config and is extractable from any APK, so it is not a secret in the same sense. It is still kept out of `public/` deliberately: anything in `public/` is copied verbatim into `dist/` and into the APK's web assets, and is served publicly by the web build, which would expose the Android API key on a web origin. `npm install` warns if the file goes missing again.

---

## 2. Endpoints to build

Base URL, auth, error envelope, and cursor pagination are as described in `FRONTEND_API_HANDOFF.md` §1–2. All four routes require an authenticated Sanctum token.

### 2.1 `POST /devices/token` — register or refresh this device

```jsonc
// Request
{
  "installationId": "6c2f…-uuid",   // stable per install, generated on device
  "token": "fcm-registration-token",
  "platform": "android",             // "android" | "ios" | "web"
  "permission": "granted",           // "granted" | "denied" | "prompt"
  "appVersion": "1.0 (1)"
}
```

Response: `204`, or `{ "ok": true }`.

**Required behaviour**

- **Upsert on `(user_id, installation_id)`, not on the token.** FCM rotates tokens on its own schedule and the app re-uploads on every rotation. Keying on the token produces duplicate rows, duplicate pushes, and makes per-device revocation impossible.
- **A token may only ever belong to one user.** If the incoming `token` exists against a *different* user, delete that row first — this is a shared handset where the previous user's sign-out did not complete. Getting this wrong leaks one user's notification content to another.
- `permission: "denied"` means the OS is blocking delivery. Keep the row (the user may re-enable it) but skip it when sending, and do not count it as a reachable device.
- Store `last_seen_at`. Prune rows untouched for ~90 days.
- The frontend sends no `Idempotency-Key` here; the upsert makes the call naturally idempotent.

**Never treat the push token as a credential.** It is a delivery address. It must not authenticate a request, identify a session, or authorise anything.

### 2.2 `DELETE /devices/token/{installationId}` — revoke one device

Response: `204`. Must be scoped to the caller — deleting another user's installation must `404`.

Called on sign-out, **before** the session is torn down, so the request is still authenticated. Treat a repeat delete as success.

### 2.3 `GET /notifications/prefs`

```jsonc
{
  "optional": {
    "appointments": true,
    "orders": true,
    "chat": true,
    "marketing": false
  },
  "required": [
    { "key": "security", "label": "Security alerts" },
    { "key": "money",    "label": "Money & wallet activity" }
  ],
  "quietHours": { "start": "22:00", "end": "07:00", "allowTimeSensitive": true }
}
```

- `required` is **server-listed and read-only**. The UI renders it as always-on. The product rule is that security and money events cannot be silently disabled, so those keys must never appear in `optional`.
- `quietHours` may be `null`. Times are `HH:mm`; state in the OpenAPI doc whether they are user-local or UTC — the app currently displays them verbatim and does not convert.
- Return sensible defaults for a user who has never set preferences, rather than `404`.

### 2.4 `PATCH /notifications/prefs`

Request is a partial: `{ "optional": { "chat": false } }` and/or `{ "quietHours": {…} | null }`.

- **Respond with the full, updated preferences object.** The app writes the response straight into its cache rather than re-fetching, so a value the server refused to change must come back unchanged — the toggle then snaps back on its own.
- Reject an attempt to disable a required category with `422` and `code: "required_category"`. Do not silently ignore it: a user who thinks they switched off security alerts is worse than a user who is told they cannot.

---

## 3. FCM payload contract

The app is built against **FCM HTTP v1** (`https://fcm.googleapis.com/v1/projects/{project}/messages:send`), authenticated with the Firebase service account.

### 3.1 Shape

```jsonc
{
  "message": {
    "token": "<device token>",
    "notification": {              // what the OS displays
      "title": "Appointment confirmed",
      "body": "Tomorrow, 10:00 with Dr Ade"
    },
    "android": {
      "priority": "high",          // "normal" for marketing
      "notification": {
        "channel_id": "cruxcare-default",
        "icon": "ic_stat_cruxcare",
        "color": "#0E7C6B",
        "tag": "appointment-apt_123"   // collapses supersedes in the shade
      }
    },
    "data": {
      "notificationId": "ntf_9f2",
      "category": "appointments",
      "route": "book-appointment",
      "params": "{\"id\":\"apt_123\"}"
    }
  }
}
```

### 3.2 Rules the app depends on

- **Every `data` value must be a string.** FCM rejects non-string data values outright. `params` in particular is a **JSON-encoded string**, not an object — the app `JSON.parse`s it. A malformed value still opens the screen, just without params.
- **`route` is a Vue Router *route name*, not a URL path.** This keeps URL structure owned by the app. Current names live in `src/router/routes.ts`; the ones worth targeting are `notifications`, `order-detail`, `orders-list`, `book-appointment`, `care-hub`, `care-requests`, `chat-thread`, `wallet-home`, `wallet-top-up`, `ledger`, `therapist-today`, `therapist-plan`, `appointment-management`, `case-file`, `video-visit`, `admin-approvals`, `security-privacy`. Section 4 maps every event to one of these. An unknown name is not an error — the app falls back to the notifications inbox, which is what makes it safe for the server to reference a route a older build does not have yet.
- **`channel_id` must be `cruxcare-default`** to match `DEFAULT_CHANNEL_ID` in the push service and the manifest default. A different value creates a second channel the user was never told about.
- **`category` must be one of** `appointments | orders | wallet | cases | chat | marketing | system` — the same vocabulary as `AppNotification.category` in `GET /notifications`.
- The category on the wire is **not always the preference key that gated it**. `security` has no wire category of its own: it travels as `system` while still being gated by the unmutable `security` preference. Anything unrecognised degrades to `system`. `App\Support\Push\NotificationCategory` on the API side is the source of truth for both columns.
- **`notificationId` should match the row `GET /notifications` returns**, so a tap can reconcile with the inbox.
- Always send both `notification` and `data`. A data-only message is not displayed by the Capacitor plugin when the app is backgrounded.

### 3.3 Send-time responsibilities

- **Persist first, push second.** The inbox (`GET /notifications`) is the source of truth; the push is a nudge. A push whose row does not exist leaves a dead-end tap.
- Respect preferences and quiet hours **on the server**. The device does no filtering.
- Fan out per device row, not per user, and honour `permission` and `platform`.
- **Handle FCM's error responses**: `UNREGISTERED` and `INVALID_ARGUMENT` on a token mean delete that device row. Retry `UNAVAILABLE`/`INTERNAL` with backoff. Silent failure here degrades into "push stopped working for some users" months later.
- Never put PHI or money amounts in `title`/`body`. They render on the lock screen. "You have a new case-file note" — not its contents. The channel is declared with `visibility: 0` (private), but do not rely on that alone.

---

## 4. Notification catalogue — what to send, and when

Every user-visible action below deserves a push. This list is the build order for the sending side, because **the app cannot raise any of these itself**. A push originates on the server; the device only registers a token, displays what arrives, and routes the tap. "Notify on X" is therefore always server-side work — the client half is already done and shipped.

Two rules apply to every row:

- **Persist first, push second** (§3.3). The `GET /notifications` row is the record; the push is the nudge. `notificationId` ties them together.
- **Required** rows are security or money events. They ignore the optional-category switches in `GET /notifications/prefs` and are what should appear under `required` there. Everything else respects both the category switch and quiet hours.

Titles and bodies are the sender's to write, under §3.3's rule: no PHI, no amounts, no client names in `title`/`body`, because they render on a lock screen.

### 4.1 Care and therapist requests

| Event | Fires when | Goes to | `category` | Req. | `route` (+ `params`) | `tag` |
| --- | --- | --- | --- | --- | --- | --- |
| Request received | client submits `POST /care/requests` naming a therapist | that therapist | `system` | no | `appointment-management` | `care-req-{id}` |
| Request in review | staff or the therapist opens it — `status → in-review` | client | `system` | no | `care-requests` | `care-req-{id}` |
| Request accepted | `status → accepted` | client | `system` | no | `care-hub` | `care-req-{id}` |
| Request declined | `status → declined` | client | `system` | no | `care-requests` | `care-req-{id}` |
| Request re-matched | staff attaches a different therapist | client | `system` | no | `care-requests` | `care-req-{id}` |
| Request closed | `status → closed` with no assignment | client | `system` | no | `care-requests` | `care-req-{id}` |

An unnamed request goes to a staff queue, not to a device — there is no push for it.

The client's own "request sent" confirmation is an **inbox row only**: they are looking at the screen that just sent it, and a push there is noise. The row still has to exist so the history is complete.

`tag` is the request id throughout, so a request that moves twice replaces its own entry in the shade instead of stacking.

### 4.2 Appointments

| Event | Fires when | Goes to | `category` | Req. | `route` (+ `params`) | `tag` |
| --- | --- | --- | --- | --- | --- | --- |
| Appointment requested | `POST /appointments` | therapist | `appointments` | no | `appointment-management` | `appt-{id}` |
| Appointment confirmed | `status → confirmed` | client | `appointments` | no | `book-appointment` | `appt-{id}` |
| Appointment cancelled | `status → cancelled` | the other party | `appointments` | no | `book-appointment` | `appt-{id}` |
| Appointment rescheduled | slot changes | both parties | `appointments` | no | `book-appointment` | `appt-{id}` |
| Reminder, 24h out | scheduler | client + therapist | `appointments` | no | `book-appointment` | `appt-{id}-24h` |
| Reminder, 1h out | scheduler | client + therapist | `appointments` | no | `book-appointment` | `appt-{id}-1h` |
| Visit starting | video visit opens | client + therapist | `appointments` | no | `video-visit` + `{"id":"…"}` | `appt-{id}-live` |
| Marked no-show | `status → no-show` | client | `appointments` | no | `book-appointment` | `appt-{id}` |

Reminders are the one place `allowTimeSensitive` inside `quietHours` matters — honour it there and nowhere else.

### 4.3 Messages and case files

| Event | Fires when | Goes to | `category` | Req. | `route` (+ `params`) | `tag` |
| --- | --- | --- | --- | --- | --- | --- |
| New message | `POST /chat/threads/{id}/messages` | the other participant | `chat` | no | `chat-thread` + `{"id":"…"}` | `thread-{id}` |
| New case-file note | therapist saves a note that is not a draft | client | `system` | no | `care-hub` | `case-{id}` |
| New recommendation | therapist recommends a product | client | `system` | no | `care-hub` | `case-{id}` |

Suppress the message push when the recipient is live in that thread — see the realtime question in §6. Collapsing on `thread-{id}` keeps an unread burst to one entry rather than forty.

### 4.4 Orders

| Event | Fires when | Goes to | `category` | Req. | `route` (+ `params`) | `tag` |
| --- | --- | --- | --- | --- | --- | --- |
| Order placed | checkout succeeds | buyer | `orders` | no | `order-detail` + `{"id":"…"}` | `order-{id}` |
| Order payment failed | gateway declines | buyer | `orders` | **yes** | `order-detail` + `{"id":"…"}` | `order-{id}` |
| Order shipped | fulfilment | buyer | `orders` | no | `order-detail` + `{"id":"…"}` | `order-{id}` |
| Out for delivery | fulfilment | buyer | `orders` | no | `order-detail` + `{"id":"…"}` | `order-{id}` |
| Delivered | fulfilment | buyer | `orders` | no | `order-detail` + `{"id":"…"}` | `order-{id}` |
| Order cancelled or refunded | staff or system | buyer | `orders` | **yes** | `order-detail` + `{"id":"…"}` | `order-{id}` |
| Ordered on your behalf | therapist orders for a client | client | `orders` | no | `order-detail` + `{"id":"…"}` | `order-{id}` |

### 4.5 Wallet and money

Money movement is **required** across the board: a user cannot switch off being told their balance changed.

| Event | Fires when | Goes to | `category` | Req. | `route` (+ `params`) | `tag` |
| --- | --- | --- | --- | --- | --- | --- |
| Wallet funded | a `wallet-topup` intent settles | funder | `wallet` | **yes** | `wallet-home` | `topup-{ref}` |
| Funding failed | that intent fails, or expires unpaid | funder | `wallet` | **yes** | `wallet-top-up` | `topup-{ref}` |
| Funding still pending | a bank transfer has not landed after ~15 min | funder | `wallet` | **yes** | `wallet-home` | `topup-{ref}` |
| Withdrawal submitted | `POST /wallet/actions` accepted | owner | `wallet` | **yes** | `ledger` | `wd-{ref}` |
| Withdrawal settled or failed | payout resolves | owner | `wallet` | **yes** | `ledger` | `wd-{ref}` |
| Transfer sent | transfer settles | sender | `wallet` | **yes** | `ledger` | `txf-{ref}` |
| Transfer received | transfer settles | recipient | `wallet` | **yes** | `ledger` | `txf-{ref}` |
| Contribution posted | cooperative contribution settles | member | `wallet` | **yes** | `member-cooperative` | `coop-{ref}` |
| Interest credited | commitment interest run | member | `wallet` | **yes** | `member-commitment` | `int-{period}` |
| Rank earning credited | earnings run | member | `wallet` | **yes** | `member-earnings` | `rank-{period}` |

Funding deserves particular care. The customer may background the app the moment the gateway sheet closes, and with a bank transfer they almost certainly will. The push is what tells them it worked: `WalletTopUpScreen` shows "awaiting confirmation" and deliberately does not sit there polling.

### 4.6 Plan, verification and account security

| Event | Fires when | Goes to | `category` | Req. | `route` (+ `params`) | `tag` |
| --- | --- | --- | --- | --- | --- | --- |
| Plan activated | plan payment settles | therapist | `wallet` | **yes** | `therapist-today` | `plan-{id}` |
| Plan payment pending | activation returns `pending_payment` and stays there | therapist | `wallet` | **yes** | `therapist-plan` | `plan-{id}` |
| Plan payment failed | gateway declines | therapist | `wallet` | **yes** | `therapist-plan` | `plan-{id}` |
| Plan renewal due | 7 days, then 1 day, before expiry | therapist | `system` | no | `therapist-plan` | `plan-renew-{id}` |
| Plan expired | expiry passes | therapist | `wallet` | **yes** | `therapist-plan` | `plan-{id}` |
| Verification approved or rejected | admin decides | applicant | `system` | **yes** | `therapist-today` or `become-therapist` | `verify-{id}` |
| New verification to review | applicant submits | admins | `system` | no | `admin-approvals` | `verify-{id}` |
| Sign-in on a new device | session created on an unrecognised device | account owner | `system` | **yes** | `security-privacy` | `session-{id}` |
| Password or email changed | credential change succeeds | account owner | `system` | **yes** | `security-privacy` | `cred-{ts}` |
| Payout account changed | therapist payout details change | therapist | `system` | **yes** | `therapist-payout-account` | `payout-{ts}` |
| Deletion scheduled or completed | account deletion flow | account owner | `system` | **yes** | `security-privacy` | `del-{ts}` |

### 4.7 Marketing

Anything promotional is gated on the `marketing` preference being explicitly `true`, sent at `priority: "normal"`, and carries `category: "system"` on the wire. It is the only class of message that may be suppressed entirely.

---

## 5. Sequences worth agreeing on

**Sign-in** → app requests OS permission → `register()` → `registration` event yields token → `POST /devices/token`.
A token can arrive *before* the session exists (the listener is attached at app start). The app holds it and uploads on sign-in, so expect a registration immediately after login with no preceding rotation.

**Token rotation** → `registration` fires again → `POST /devices/token` with the same `installationId` and a new `token` → upsert replaces the row.

**Sign-out** → `DELETE /devices/token/{installationId}` (still authenticated) → local `unregister()`.
If the delete fails (offline), the app still unregisters locally and continues signing out. **The server must therefore also drop tokens FCM reports as `UNREGISTERED`**, or an offline sign-out leaves a stale row forever.

**Permission revoked in OS settings** → next upload carries `permission: "denied"`. There is no event for this, so the value is only as fresh as the last registration; treat an `UNREGISTERED` from FCM as the authoritative signal.

---

## 6. Open questions for the backend team

1. **Firebase project ownership** — who creates it, and who holds the service-account key? Needed before anything else can be tested on a device.
2. **Quiet hours timezone** — user-local (requires storing a timezone) or UTC? The app currently displays the strings as given.
3. **iOS** — there is no `ios/` directory in this repo yet. The client code is platform-agnostic and will report `platform: "ios"` unchanged, but APNs certificates/keys and an `ios` block in the FCM payload are not covered here.
4. **Realtime vs push** — `FRONTEND_API_HANDOFF.md` §5 still has Echo/Reverb unwired. Decide which events are push-only, which are realtime-only, and which are both, so a user reading a chat in-app does not also get a push for it.
5. **Marketing consent** — `marketing` defaults to `false`. Confirm whether an explicit opt-in record is required for compliance beyond this flag.
