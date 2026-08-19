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
- **`route` is a Vue Router *route name*, not a URL path.** This keeps URL structure owned by the app. Current names live in `src/router/routes.ts`; the ones worth targeting are `notifications`, `order-detail`, `orders-list`, `book-appointment`, `chat-thread`, `wallet-home`, `ledger`, `therapist-today`, `appointment-management`. An unknown name is not an error — the app falls back to the notifications inbox, which is what makes it safe for the server to reference a route a older build does not have yet.
- **`channel_id` must be `cruxcare-default`** to match `DEFAULT_CHANNEL_ID` in the push service and the manifest default. A different value creates a second channel the user was never told about.
- **`category` must be one of** `appointments | orders | wallet | chat | system` — the same vocabulary as `AppNotification.category` in `GET /notifications`.
- **`notificationId` should match the row `GET /notifications` returns**, so a tap can reconcile with the inbox.
- Always send both `notification` and `data`. A data-only message is not displayed by the Capacitor plugin when the app is backgrounded.

### 3.3 Send-time responsibilities

- **Persist first, push second.** The inbox (`GET /notifications`) is the source of truth; the push is a nudge. A push whose row does not exist leaves a dead-end tap.
- Respect preferences and quiet hours **on the server**. The device does no filtering.
- Fan out per device row, not per user, and honour `permission` and `platform`.
- **Handle FCM's error responses**: `UNREGISTERED` and `INVALID_ARGUMENT` on a token mean delete that device row. Retry `UNAVAILABLE`/`INTERNAL` with backoff. Silent failure here degrades into "push stopped working for some users" months later.
- Never put PHI or money amounts in `title`/`body`. They render on the lock screen. "You have a new case-file note" — not its contents. The channel is declared with `visibility: 0` (private), but do not rely on that alone.

---

## 4. Sequences worth agreeing on

**Sign-in** → app requests OS permission → `register()` → `registration` event yields token → `POST /devices/token`.
A token can arrive *before* the session exists (the listener is attached at app start). The app holds it and uploads on sign-in, so expect a registration immediately after login with no preceding rotation.

**Token rotation** → `registration` fires again → `POST /devices/token` with the same `installationId` and a new `token` → upsert replaces the row.

**Sign-out** → `DELETE /devices/token/{installationId}` (still authenticated) → local `unregister()`.
If the delete fails (offline), the app still unregisters locally and continues signing out. **The server must therefore also drop tokens FCM reports as `UNREGISTERED`**, or an offline sign-out leaves a stale row forever.

**Permission revoked in OS settings** → next upload carries `permission: "denied"`. There is no event for this, so the value is only as fresh as the last registration; treat an `UNREGISTERED` from FCM as the authoritative signal.

---

## 5. Open questions for the backend team

1. **Firebase project ownership** — who creates it, and who holds the service-account key? Needed before anything else can be tested on a device.
2. **Quiet hours timezone** — user-local (requires storing a timezone) or UTC? The app currently displays the strings as given.
3. **iOS** — there is no `ios/` directory in this repo yet. The client code is platform-agnostic and will report `platform: "ios"` unchanged, but APNs certificates/keys and an `ios` block in the FCM payload are not covered here.
4. **Realtime vs push** — `FRONTEND_API_HANDOFF.md` §5 still has Echo/Reverb unwired. Decide which events are push-only, which are realtime-only, and which are both, so a user reading a chat in-app does not also get a push for it.
5. **Marketing consent** — `marketing` defaults to `false`. Confirm whether an explicit opt-in record is required for compliance beyond this flag.
