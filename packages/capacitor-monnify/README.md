# @cruxcare/capacitor-monnify

A Capacitor bridge to Monnify's own checkout SDK — the native sheet on Android, the hosted modal in a browser.

Card and account credentials are entered inside Monnify's UI. They never pass through this plugin, the WebView, or CruxCare's servers.

## Why it lives here

`android/` is git-ignored in this repo (see `.gitignore`), so native source placed there would not survive a clone or a `cap add android`. The plugin is a local package instead, linked via `"@cruxcare/capacitor-monnify": "file:packages/capacitor-monnify"` in the root `package.json`.

- **Native side** is discovered by `npx cap sync android` through the `capacitor.android.src` field in `package.json`.
- **JavaScript side** is consumed straight from TypeScript source via an alias in `vite.config.ts` and `tsconfig.json`, so there is no separate build step. Publishing this standalone would mean adding a Rollup build and pointing `main`/`module`/`types` at `dist/`.

## Usage

```ts
import { Monnify } from '@cruxcare/capacitor-monnify';

await Monnify.configure({
  apiKey: 'MK_TEST_…',        // public merchant identifier
  contractCode: '1234567890',
  applicationMode: 'TEST',    // 'LIVE' moves real money
});

const result = await Monnify.charge({
  amount: 1500,                       // major units
  currencyCode: 'NGN',
  paymentReference: 'CCPAY-…',        // minted by the API, never on the device
  paymentDescription: 'CruxCare monthly plan',
  customerName: 'Amaka Obi',
  customerEmail: 'amaka@cruxcare.app',
});
```

`charge()` rejects only when the payment could not be **started** (not configured, no activity, invalid request). A cancelled or failed payment *resolves*, with the outcome in `result.status`.

In this app you normally go through `src/services/payment/` rather than calling the plugin directly.

## `result.status` is not settlement

It is what the sheet reported before it closed. Whether money actually moved is decided by the CruxCare API after it verifies the transaction with Monnify server-to-server. See `docs/PAYMENTS_MONNIFY_CONTRACT.md`.

## Platform support

| Platform | Implementation |
| --- | --- |
| Android | `com.monnify.android-sdk:monnify-android-sdk:1.1.8` (Kotlin package `com.teamapt.monnify.sdk`) |
| Web | Monnify Web SDK, loaded on demand from `sdk.monnify.com` |
| iOS | Not implemented — there is no `ios/` directory in this repo |

## Android build requirements

Both are applied automatically by `scripts/patch-android-push-and-monnify.mjs`, which runs on `postinstall`:

1. **JitPack repository.** Two of the Monnify SDK's transitive dependencies (`MasayukiSuda:BubbleLayout`, `NaikSoftware:StompProtocolAndroid`) are published only on JitPack; without it the Gradle sync fails to resolve.
2. **`tools:replace="android:theme"`** on the app's `<application>`. Monnify's AAR declares its own `android:theme`, and two values for one attribute is a manifest-merger failure rather than a silent win.

## Implementation notes

Monnify calls `startActivityForResult` itself, so this plugin uses Capacitor's legacy `@CapacitorPlugin(requestCodes = …)` plus `handleOnActivityResult` — the path Capacitor documents for third-party SDKs that do not use the AndroidX Activity Result API. A concurrent second `charge()` is rejected rather than queued, since two overlapping sheets could double-charge.
