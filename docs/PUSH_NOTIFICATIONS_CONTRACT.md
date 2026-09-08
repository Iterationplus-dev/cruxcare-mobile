<!--
  VENDORED COPY — do not edit here.

  Taken from cci/docs/ at 9c4fca4bad7aeb1efb51c88993374a6fd97a9f13
  (9c4fca4, "Backend for the mobile team's contract notes", 8 September 2026).

  cci/docs/ is canonical, agreed 8 September 2026 (N1.1). Changes belong there;
  re-vendor this file and update the SHA above rather than editing it, so a stale
  copy is visible instead of silent.
-->
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

### One blocker that is not a code problem

**`android/app/google-services.json` does not exist.** Without it the `com.google.gms.google-services` Gradle plugin is skipped (see the `try/catch` at the bottom of `android/app/build.gradle`) and registration fails at runtime with a `registrationError`. Someone with Firebase console access must add the Android app `com.cruxcintl.mobile` and drop the file in. `npm install` now prints a warning while it is missing.

> The same Firebase project's **service account JSON** is what Laravel needs for FCM HTTP v1 — it must go in server config, never in the repo and never in the app.

---

## 2. Endpoints to build

> **Source of truth.** This file in `cci/docs/` is canonical, agreed 8 September
> 2026. Vendored copies should record the commit they were taken from, so a
> stale one is visible rather than silent.

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
    "cases": true,
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
- **`route` is a Vue Router *route name*, not a URL path.** This keeps URL structure owned by the app. Current names live in `src/router/routes.ts`; the ones worth targeting are `notifications`, `order-detail`, `orders-list`, `book-appointment`, `chat-thread`, `wallet-home`, `ledger`, `therapist-today`, `appointment-management`, `health-profile-access`, `case-file`, `care-plan`, `care-hub`. An unknown name is not an error — the app falls back to the notifications inbox, which is what makes it safe for the server to reference a route a older build does not have yet.
- **`channel_id` must be `cruxcare-default`** to match `DEFAULT_CHANNEL_ID` in the push service and the manifest default. A different value creates a second channel the user was never told about.
- **`category` must be one of** `appointments | orders | wallet | cases | chat | marketing | system` — the same vocabulary as `AppNotification.category` in `GET /notifications`.
- The category on the wire is **not always the preference key** that gated it. `App\Support\Push\NotificationCategory` is the single source of truth for both columns:

  | Preference | Internal / FCM category |
  | --- | --- |
  | `security` | `security`, sent on the wire as `system` |
  | `money` | `wallet` |
  | `appointments` | `appointments` |
  | `orders` | `orders` |
  | `cases` | `cases` |
  | `chat` | `chat` |
  | `marketing` | `marketing` |
  | `system` | `system` |

  `security` has no wire category of its own — it travels as `system` while still being gated by the unmutable `security` preference. Anything unrecognised degrades to `system`.
- **`notificationId` should match the row `GET /notifications` returns**, so a tap can reconcile with the inbox.
- Always send both `notification` and `data`. A data-only message is not displayed by the Capacitor plugin when the app is backgrounded.

### 3.3 Send-time responsibilities

- **Persist first, push second.** The inbox (`GET /notifications`) is the source of truth; the push is a nudge. A push whose row does not exist leaves a dead-end tap.
- Respect preferences and quiet hours **on the server**. The device does no filtering.
- Fan out per device row, not per user, and honour `permission` and `platform`.
- **Handle FCM's error responses**: `UNREGISTERED` and `INVALID_ARGUMENT` on a token mean delete that device row. Retry `UNAVAILABLE`/`INTERNAL` with backoff. Silent failure here degrades into "push stopped working for some users" months later.
- Never put PHI or money amounts in `title`/`body`. They render on the lock screen. "You have a new case-file note" — not its contents. The channel is declared with `visibility: 0` (private), but do not rely on that alone.

#### The case lifecycle — six events (§16.9)

All `category: cases`, all optional, persist-first. `care-plan` and `care-hub`
take the **case** id, not a plan or subscription id: both screens are about one
case.

| Event | Fires when | Goes to | `route` |
| --- | --- | --- | --- |
| Plan proposed | `POST /cases/{id}/plan` | client | `care-plan` |
| Plan paid for | the settled payment opens the subscription | therapist | `case-file` (the file's own id) |
| Treatment started | `POST /cases/{id}/start` | client | `care-hub` |
| Follow-up booked | `POST /cases/{id}/follow-up` | client | `care-hub` |
| Plan nearly spent | `cruxcare:review-care-plans`, daily | client | `care-plan` |
| Case closed | `POST /cases/{id}/close` | client | `care-hub` |

No diagnosis or condition in `title`/`body`. "Your therapist has sent you a care
plan" is the whole message; the reasoning is on the screen behind the login.
The closing notification is the one exception worth noting: where unused paid
visits remain it says so, because a client who thinks their sessions died with
the case has been misled by silence.

#### Health profile access — the two events (§14.5)

Both are `category: cases`, so they respect the category switch and quiet hours:
these are neither security nor money.

| Event | Fires when | Goes to | `route` | `params` |
| --- | --- | --- | --- | --- |
| Access requested | `POST /clients/{id}/health-profile/access` | client | `health-profile-access` | `{"id":"<accessId>"}` |
| Access answered | `.../grant` or `.../revoke` | therapist | `case-file` | `{"id":"<accessId>"}` |

The requesting therapist's **name is deliberately absent from the lock screen**.
The body is sent with the sensitive flag, so it renders as "Open CruxCare to
view" on the handset while the inbox row keeps the full text — on a health app,
which clinician is asking is close enough to PHI to stay behind the login. The
name is on the screen the tap opens, where the client has already authenticated.

Each carries an `id` param, which gives the notification a tag: a second ask
replaces the first in the shade rather than stacking beside it.

---

## 4. Notification catalogue

Merged from the mobile team's copy on 8 September 2026 and rebuilt from the send
sites rather than transcribed, because this table is a claim about what the
server does and the server is here. Every row below is a live
`PushDispatcher` call; if a row is wrong, the code is what to change.

`security` and `money` (the preference key for `wallet`) outrank quiet hours and
cannot be switched off. Everything else respects both.

### 4.1 Care requests and the case lifecycle

| Event | Goes to | `category` | `route` |
| --- | --- | --- | --- |
| Care request submitted | client | `cases` | `care-requests` |
| Care request sent to a named therapist | therapist | `cases` | `therapist-care-requests` |
| Client withdrew a request | therapist | `cases` | `therapist-care-requests` |
| Request accepted | client | `cases` | `care-requests` |
| Request declined | client | `cases` | `care-requests` |
| Care plan proposed | client | `cases` | `care-plan` |
| Care plan paid for | therapist | `cases` | `case-file` |
| Treatment started | client | `cases` | `care-hub` |
| Follow-up booked | client | `cases` | `care-hub` |
| Care plan nearly spent | client | `cases` | `care-plan` |
| Case closed | client | `cases` | `care-hub` |
| Therapist shared a resource | client | `cases` | — *(held, see 4.5)* |

### 4.2 Health profile access

| Event | Goes to | `category` | `route` | Notes |
| --- | --- | --- | --- | --- |
| Access requested | client | `cases` | `health-profile-access` | **sensitive** — the practitioner's name stays off the lock screen |
| Access granted or withdrawn | therapist | `cases` | `case-file` | Carries the case file's id, not the consent row's |

### 4.3 Appointments

| Event | Goes to | `category` | `route` |
| --- | --- | --- | --- |
| Session requested | therapist | `appointments` | — |
| Session started | client | `appointments` | `video-visit` + id, or none *(see 4.5)* |
| Session status changed | the other party | `appointments` | — |
| Reschedule proposed | the other party | `appointments` | — |
| Session closed as abandoned | both | `appointments` | — |
| You were rated | therapist | `appointments` | `therapist-profile` |

### 4.4 Money, orders and security

| Event | Goes to | `category` | `route` | Notes |
| --- | --- | --- | --- | --- |
| Order placed | buyer | `orders` | — | |
| Order placed on your behalf | beneficiary | `orders` | — | Admin and staff only; therapists cannot place these |
| Wallet credited | user | `wallet` | `wallet-home` | **sensitive** |
| Contribution received | user | `wallet` | `wallet-home` | **sensitive** |
| Withdrawal submitted | user | `wallet` | `ledger` | **sensitive** |
| Transfer submitted | user | `wallet` | `ledger` | **sensitive** |
| Therapist plan activated | therapist | `cases` | — | |
| Plan payment pending | therapist | `cases` | — | |
| Password changed | user | `security` | — | Cannot be switched off |
| Password reset confirmation failed | user | `security` | `security-privacy` | Cannot be switched off |
| Payout account changed | user | `security` | `wallet-home` | Cannot be switched off |
| Account deletion requested | user | `security` | — | Cannot be switched off |
| New chat message | recipient | `chat` | — | |

### 4.5 The route names, and the three that had no screen

Writing this table down found ten sends passing a URL path where §3.2 requires a
Vue Router route name. An unknown name is not an error — the app falls back to
the inbox by design — so each of those taps had been landing one screen from
where it was aimed, with nothing in any log to say so. The fallback that makes
the contract safe is what hid the bug.

Seven are fixed with names the mobile team supplied on 8 September 2026:
`care-requests`, `therapist-care-requests`, `therapist-profile`,
`security-privacy`, and `point-facility-session`. The remaining three needed a
decision rather than a name.

**`point-facility-session` takes no `:id` yet.** The send carries the param
anyway. Vue Router drops a param the route has no segment for, so today the tap
opens the generic session screen — no worse than omitting it — and the moment
the segment is added it starts resolving with no change on this side.

**Session started has no client-side screen unless it is a video visit.** The
client app has booking and the care hub, and nothing that opens one appointment.
So the send routes to `video-visit` with the appointment id when the visit is
video, and carries no route at all otherwise. Landing in the inbox deliberately
is honest; routing "your session has started" at the booking flow is not.

**The resource-share push is held entirely.** CD7 "Resources" is designed but
not built, and there is no route that answers to it, so the notification would
buzz a client about something they cannot reach. The share is still recorded;
only the nudge waits, behind `cruxcare.resources.notify_on_share`. Inventing a
name now would guarantee a silent mismatch the day the screen ships under a
different one.

`PushRouteContractTest` now scans every source file for a `route:` argument
beginning with `/` and fails if one appears, so this class of bug cannot return
quietly.

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
