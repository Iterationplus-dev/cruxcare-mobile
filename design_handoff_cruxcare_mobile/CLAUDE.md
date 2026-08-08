# CruxCare mobile — instructions for the coding agent

You are implementing a finished, locked design. This folder is the specification. Do not redesign, rename screens, invent copy, or add features that are not drawn.

## Read in this order

1. `README.md` — the spec. Tokens, component specs, IA, product rules, interactions, state, assets, build order, open items. **This is the source of truth for every value.**
2. `SCREENS.md` — all 125 screens by code (`CA1`, `E4`, `TD7`…), each with purpose and design notes.
3. `screenshots/<CODE>.png` — a 390×844 render of each screen, named by the same codes. Look at the screenshot before building a screen.
4. `design/*.dc.html` — the interactive prototypes. Open in a browser to inspect real markup, spacing and states. Reference only.
5. `reference/PRD-clean.md`, `reference/DesignScope-clean.md` — product background when a rule's intent is unclear.

## What the design files are

HTML prototypes, not production code. Recreate them in the target codebase using its own patterns and libraries. The intended stack is **Ionic 8 + Vue 3 + TypeScript** with Capacitor (push, camera, biometrics, secure storage); map each drawn component to an Ionic primitive plus project styling. `design/support.js` and `design/image-slot.js` are prototype runtime — never port them. `design/assets/ta4-map.html` is a reference map only; use the app's real map SDK.

Fidelity is **high**: colors, type, spacing, radii, copy and states are final. Two gaps are deliberate — tablet two-pane layouts (≥768px) are not drawn, and all photography is placeholder.

## Non-negotiable rules

Full list in README (“Rules the structure enforces”, “Money rules encoded in the designs”). The ones most likely to be broken in code:

- **Never compute money client-side.** Fees, locks, notice periods and resulting balances are server-quoted and displayed before confirm. Withdrawals/transfers carry a minimum 5% admin charge; commitment pays 1.8%/month with a 60-day notice to return capital; cooperative help needs 12 consistent weeks, 3 guarantors and admin approval.
- **Never show optimistic success on a money action.** E5 reads “Submitted”, not “Done”.
- **Money writes are disabled offline** (N3). Step-up auth (OTP or biometric) precedes payouts and transfers.
- **One account, roles added.** Never a second registration for therapists; client tabs stay reachable in therapist context.
- **Health data follows the booking.** Only a therapist with a confirmed session can read a health profile; PR4 can revoke.
- **Ship each screen with its states.** N1–N4 (loading / empty / offline / error) are shared components built once and inherited everywhere. Error variants that are drawn (`CA3-e`, `CA4-e`, `TA3-r`, `PR6`, `TD2`) are part of their screen, not a later task.
- **Accessibility:** WCAG 2.1 AA on every text pair, 44px minimum targets (56px in elder mode, L1–L4), 11px type floor, dynamic type to 200% without clipping, `prefers-reduced-motion` respected.

## Build order

Follow “Suggested build order” in README — tokens and shell first, then auth, then the role model, then the state pass, then feature modules. Build the server-quoted fee preview once in the wallet module (E1–E5) and reuse it for commitment, cooperative and rank.

## Definition of done, per screen

- Matches its screenshot at 390×844 and reflows above and below it.
- Uses tokens only — no ad-hoc hex, spacing or radius values.
- Copy matches SCREENS.md and the prototype verbatim.
- Loading, empty, offline and error states wired to the shared components.
- Targets, contrast and dynamic type verified.

## Open questions — ask, do not decide

Payment provider, video provider, Bronze/Silver earnings rates, tablet layouts, and final photography are unresolved (README “Open items for the build team”). Stub behind an interface and flag it; do not invent rates or a provider SDK.
