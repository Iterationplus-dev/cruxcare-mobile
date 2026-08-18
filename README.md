# CruxCare Mobile

Cross-platform mobile client for CruxCare International — wellness commerce, therapist care, member finance, and a shared wallet in one app. Built with Ionic Vue and shipped natively through Capacitor.

The app is a pure API client. All business rules, money, and permissions are owned by the Laravel `/api/v1` backend; the frontend renders what the server returns and hides what the server says the account cannot do.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Vue 3 (`<script setup>`, TypeScript) + Ionic 8 |
| Native shell | Capacitor 8 (Android, iOS) |
| Build | Vite 5 |
| Routing | Vue Router via `@ionic/vue-router` |
| State | Pinia (session/user), TanStack Query (server cache) |
| Forms | VeeValidate + Zod |
| API | Axios, bearer token in native secure storage |
| Mock API | MSW (`src/mocks/`) |
| Tests | Vitest (unit + component), Cypress (e2e) |

---

## Getting started

```bash
npm install          # postinstall patches two plugins for current Gradle
cp .env.example .env # then edit for your environment
npm run dev          # http://localhost:5173
```

`npm install` runs `scripts/patch-native-biometric-gradle.mjs`, which rewrites `jcenter()` to `mavenCentral()` in the biometric and secure-storage plugins so the Android build resolves.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | Base URL of the Laravel gateway, including `/api/v1` |
| `VITE_USE_API_MOCKS` | `true` serves every request from the MSW fixtures in `src/mocks/` instead of the network |
| `VITE_API_HOST_HEADER` | Optional `Host` header, for virtual-host setups reached by IP |
| `VITE_ECHO_HOST` / `VITE_ECHO_KEY` | Laravel Echo/Reverb realtime connection |

Two env files are committed. `.env.example` is the template to copy; `.env.emulator` is loaded by `--mode emulator` and points at `10.0.2.2`, the Android emulator's alias for the host machine.

### Mock mode

With `VITE_USE_API_MOCKS=true` the app runs entirely offline against `src/mocks/`, which is the fastest way to work on screens. `src/mocks/testAccount.ts` holds a client-only account for exercising onboarding; `demoCredentials` in `src/mocks/db.ts` holds a multi-role account (client + member + therapist).

---

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check then production build |
| `npm run build:emulator` | Production build in `emulator` mode |
| `npm run sync:android:emulator` | Emulator build followed by `cap sync android` |
| `npm run typecheck` | `vue-tsc --noEmit` |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm test` | Full Vitest suite |
| `npm run test:unit` / `npm run test:component` | One Vitest layer |
| `npm run test:e2e` | Cypress |

---

## Running on Android

```bash
npm run sync:android:emulator
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.cruxcintl.mobile/.MainActivity
```

The application id is `com.cruxcintl.mobile`. Opening `android/` in Android Studio and running from there works too.

Notes for this platform:

- **The generated native project is not version-controlled.** `.gitignore` excludes `/android/*` apart from `gradle.properties`, so Capacitor regenerates it. A fresh clone needs `npx cap add android` (or `cap sync`) before the Gradle commands above, and the Gradle wrapper scripts arrive with it.
- **Emulator DNS.** The emulator inherits host DNS and frequently fails to resolve public hostnames on Windows, which silently breaks remote images while the API keeps working over `10.0.2.2`. Launch with an explicit resolver if images render as placeholders:
  `emulator -avd <name> -dns-server 8.8.8.8,1.1.1.1`

---

## Project structure

```
src/
├── api/          Axios client and one module per resource
├── components/   Design-system primitives (App*) and shared widgets
├── composables/  Query hooks and cross-screen behaviour
├── features/     One folder per domain: auth, home, marketplace, care,
│                 wallet, member, therapist, admin, profile, shared
├── layouts/      Tab shells — one per role context
├── mocks/        MSW handlers and fixture database
├── router/       Routes, capability guard, per-role landing routes
├── services/     Native bridges: biometric, secure storage, status bar
├── stores/       Pinia stores (auth session, cart)
├── theme/        Design tokens, typography, bundled fonts
└── types/        API and domain models
```

Screens live in `src/features/<domain>/screens/`. Anything reused across two or more domains belongs in `src/components/` or `src/composables/`.

---

## Architecture notes

**Role contexts.** An account may hold several roles (`client`, `member`, `therapist`, `admin`). Each context has its own tab shell rather than extra tabs bolted onto one bar — `TabsLayout` (client and member), `TherapistLayout`, `AdminLayout`. A session opens in the context that fits the account, and users move between contexts from Profile → Switch context. `src/router/roleHome.ts` is the single source of truth for where "home" leads.

**Guards are advisory.** `src/router/index.ts` hides routes by role and gates unverified signups, but the server is the enforcer — never treat a passing guard as authorization.

**Tokens and fonts.** Colors, spacing, and type come from CSS custom properties in `src/theme/`. Fonts (Plus Jakarta Sans, IBM Plex Mono, Material Symbols Rounded) are bundled locally, so the app makes no CDN calls at runtime. Icons go through `AppIcon`, which renders a ligature — style icons via its props, and avoid bare `span` selectors in screen CSS that could override its font.

**Money.** Totals, fees, and balances are rendered exactly as the API returns them. `MoneyAmount` handles presentation; nothing client-side recalculates a financial figure.

---

## Testing

```bash
npm test                  # unit + component
npm run test:e2e          # Cypress — needs `npm run dev` on :5173 (its baseUrl)
```

Vitest runs in jsdom with `tests/setup.ts`. Unit specs mirror `src/` under `tests/unit/`; component specs mount design-system pieces from `tests/component/`.

---

## API contract

`docs/FRONTEND_API_HANDOFF.md` is the authoritative frontend↔backend contract: endpoint list, envelope and error shapes, cursor pagination, idempotency, roles and capabilities, and the money rules. Read it before changing anything under `src/api/` or `src/types/`.
