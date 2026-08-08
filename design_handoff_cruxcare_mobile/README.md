# Handoff: CruxCare unified mobile app

## Overview

CruxCare is a health-and-wellness ecosystem operated by Crux Dynamic Care International Ltd. This handoff covers the complete mobile design for the unified app: a natural-products marketplace, therapist-led client care, and the four member programmes (Basic Network, Commitment, Cooperative, Ranking / Point Facility), all behind one role-aware account.

The design covers **125 screens** in eight files, plus a design system and a structural map. It spans onboarding and authentication, four home dashboards (client, member, therapist, admin), marketplace and checkout, care and video visits, wallet and ledger, commitment cycles, cooperative help requests, rank and downline, Point Facility live sessions, administration, notifications end-to-end, and the shared state pass (loading, empty, offline, error).

## About the design files

The files in `design/` are **design references created in HTML** — prototypes that show intended look, copy and behaviour. They are not production code to copy directly.

The task is to **recreate these designs in the target codebase**. The design system was drawn against **Ionic 8 + Vue 3 + TypeScript** (per the product's technical direction, with Capacitor for push, camera, biometrics and secure storage), so components should map to Ionic primitives and the project's own component library. If the codebase already has patterns for lists, sheets, forms and money formatting, use those — match the visual spec, not the markup.

Each screen is drawn at **390 × 844** (iPhone 14 / Pixel-class logical viewport). Treat that as the design baseline, not a fixed size: layouts must reflow, and dynamic type must scale to 200% without clipping.

## Fidelity

**High fidelity.** Colors, typography, spacing, radii, copy and states are final and specified to the pixel. Recreate the UI faithfully using the codebase's existing libraries. Two deliberate exceptions:

- **Tablet layouts are not drawn.** Two-pane variants at ≥768px (list + detail) are an implementation decision; follow the same tokens.
- **Photography is placeholder.** Product shots and the botanical background are stand-ins for final art direction (see Assets).

---

## Design tokens

### Color

| Token | Hex | Use |
| --- | --- | --- |
| `brand/primary` | `#0E7C6B` | Primary actions, active nav, key accents. Text on it must be `#FFFFFF` or `#F2F7F5`. |
| `brand/primary-dark` | `#0A5A4E` | Pressed states, headings on light, teal panels. |
| `brand/leaf` | `#2FA36B` | Growth and positive accents. Ink `#1A2B22` passes on it; white is large-text only. |
| `brand/sand` | `#F3EFE6` | Warm neutral surface / cards. |
| `brand/mist` | `#EAF3F0` | Subtle tinted background sections. |
| `semantic/success` | `#2E9E5B` | Confirmed, approved, paid. |
| `semantic/warning` | `#C9772E` | Locks, notices, fees, at-risk. |
| `semantic/danger` | `#C1443B` | Errors, destructive actions. |
| `semantic/info` | `#2B7DBD` | Informational, neutral system. |

Supporting neutrals used throughout the screens:

| Value | Use |
| --- | --- |
| `#1A2B22` | Ink / primary text |
| `#2E3A33` | Secondary body text |
| `#61706A` | Muted text, inactive tab labels, helper copy |
| `#8A9A93` | Placeholder text, dividers in low emphasis |
| `#CBD8D2` | Card and input borders, hairlines |
| `#EAF3F0` | Inner row dividers, tinted rows |
| `#F7FAF9` | App background / screen fill |
| `#FFFFFF` | Cards, sheets, tab bar |
| `#FDF2F0` / `#F3CFC8` / `#A5321F` | Error surface / error border / error text |

Rules: never more than two tinted background fills on one screen; amber (`semantic/warning`) is reserved for financial caution and is never decorative.

### Typography

Interface face: **Plus Jakarta Sans** (fallback SF Pro / Roboto for native feel). Numeric face: **IBM Plex Mono** for anything read digit-by-digit — Crux IDs, amounts, reference codes.

| Token | Spec | Example |
| --- | --- | --- |
| Display | 18/22 · 700 | `$2,480.00 available` |
| H1 | 17/22 · 700 | `Your care this week` |
| H2 | 16/21 · 700 | `Active commitment cycle` |
| Body | 14/22 · 400 | Running copy |
| Body-strong | 14/22 · 600 | `Withdrawal fee (5% minimum)` |
| Subtitle | 12/18 · 400/500 | `Week 18 of 52 · open savings` |
| Caption | 11/15 · 400/500 | `Last updated 2 minutes ago` |
| Mono | 14/20 · 500 | `CCI8804XO · REF-90412 · $1,240.00` |

- All money uses `font-variant-numeric: tabular-nums` so ledger columns align.
- **11/15 is the floor.** Nothing renders below 11px. Money figures never sit at caption size — Mono 14/20 or larger.
- Type scales with the OS setting to 200%; layouts reflow to a single column and never clip.
- **Elder-friendly mode** (Point Facility attendee screens, L1–L4): Body 17/26, Caption 15/22, touch targets 56px.

### Space, radius, elevation, touch

- **Spacing scale** (4-point): 4, 8, 12, **16 (base gutter)**, 20, **24 (section gap)**, 32, 40, 48.
- **Radius**: `sm` 8 (inputs) · `md` 12 (buttons) · `lg` 16–18 (cards) · `pill` 999 (chips, avatars). Phone shell in the prototype uses 40 — that is the device bezel, not a UI value.
- **Elevation**: `e0` flat · `e1` card · `e2` sheet. Prefer a tint plus a 1px `#CBD8D2` line over shadow; reserve shadow for things that float.
- **Touch**: 44px minimum (56px in elder mode). Primary button is 47px, full width. Screen padding 16; card padding 14–18.
- Respect safe areas; sticky CTAs sit above the home indicator.
- 4-column fluid grid, 16 gutter; product cards are 2-up.

### Component specs seen across the screens

| Component | Spec |
| --- | --- |
| Primary button | `height:47px; radius:12px; background:#0E7C6B; color:#FFFFFF; font:600 15/21` |
| Secondary button | `height:47px; radius:12px; background:#FFFFFF; border:1px solid #CBD8D2; color:#1A2B22; font:600 14/20` |
| Text button | `height:44px; transparent; color:#0E7C6B; font:600 14/20` |
| Destructive text | `color:#A5321F; font:600 13/19` |
| Input | `height:44px; radius:10px; border:1px solid #CBD8D2; padding:0 12px; font:400 14/20`. Focused: `border:1.5px solid #0E7C6B`. Error: `border:1.5px solid #C0392B; background:#FDF2F0` |
| Label | `font:600 13/19`, 4px above the field; helper text `font:400 11/16; color:#61706A`, 5px below |
| Card | `background:#FFFFFF; border:1px solid #CBD8D2; radius:16–18px; padding:14–18px` |
| List row | `padding:13px 14px; gap:11px`, leading 20px icon in `#0E7C6B`, trailing `chevron_right` in `#61706A`, `1px solid #EAF3F0` divider between rows |
| Chip / filter | `radius:999px; padding:3px 9px–8px 14px; font:600 10–13px`. Selected: `background:#0E7C6B; color:#FFFFFF` |
| Badge | `radius:999px; background:#EAF3F0; color:#0A5A4E; font:600 10/15; padding:2px 8px` |
| Tab bar | `height:66px; background:#FFFFFF; border-top:1px solid #CBD8D2; padding-bottom:8px`, 5 items, 22px icon + 10/14 label. Active `#0E7C6B` (600), inactive `#61706A` (500) |
| Status bar | `height:50px; padding:0 26px 6px`, `9:41` + signal/wifi/battery, `font:600 13/17` |
| Sheet | Bottom sheet on a `rgba(26,43,34,·)` scrim, `radius:24px 24px 0 0`, `background:#FFFFFF`, grabber above the title |

Icons are **Material Symbols Rounded** (24 opsz, 400 weight, unfilled) at 16 / 20 / 22 / 24 / 48px.

---

## Information architecture

Five client tabs carry the app: **Home · Shop · Care · Wallet · Profile**. Therapist and admin contexts are separate dashboards reached by role switch, not extra tabs.

Files map to sections:

| File | Sections |
| --- | --- |
| `CruxCare Design Hierarchy` | File map, section map, primary paths, rules |
| `CruxCare Design System` | Tokens and components (11 sections) |
| `CruxCare Auth and Account` | 1 Client auth · 2 Therapist auth · 3 Recovery · 4 Account management · 5 Profile |
| `CruxCare Client Dashboard` | 6 Client dashboard (CD1–CD8) |
| `CruxCare Therapist Dashboard` | 7 Therapist dashboard (TD1–TD8) |
| `CruxCare Phase 1 Screens` | A Onboarding · B Home dashboards · C Marketplace · D Client care |
| `CruxCare Phase 2 Finance` | E Wallet · F Commitment · G Cooperative · H Rank & network |
| `CruxCare Phase 3 Growth` | J Network & earnings · K Notifications & account |
| `CruxCare Phase 4 Engagement` | L Point Facility · M Administration · N State pass · O Push notifications |
| `CruxCare Shared Features` | 8 Shared features (SH1–SH7) |

Full screen-by-screen list: **[SCREENS.md](SCREENS.md)**.

---

## Rules the structure enforces

These are product rules the UI is built around. They should survive refactoring.

1. **One account, roles added.** A therapist never registers twice. TA2 links an existing Crux ID (format `CCI8804XO` / `CCI4419AO` — three letters, four digits, two letters); client tabs stay available through TD8.
2. **Money is disclosed before it moves.** No money action is confirmable until the server has returned the exact amount, the fee, the lock or notice period, and the resulting balance. Fees, commission, clearing times and resulting balances appear on the screen that takes the action, never after. **Never an optimistic success** — E5 is "Submitted", not "Done".
3. **Destructive actions are reversible or named.** AM2 states the exact date deletion becomes permanent; AM3 gives a one-tap undo; AM4 names unsynced work before logging out.
4. **Health data follows the booking.** Only a therapist with a confirmed session sees the health profile. PR4 lists who holds access and can withdraw it.
5. **Error states ship with their screen.** CA3-e, CA4-e, TA3, TA3-r, PR6 and TD2 carry failure, waiting and expiry cases inline.
6. **Accessibility is not optional.** WCAG 2.1 AA on every text pair, 44px targets, and the three color rules above govern any new screen.

### Money rules encoded in the designs

- Withdrawals and member transfers carry a **minimum 5% admin charge**, previewed server-side before confirm (E3 → E4 → E5).
- Commitment: interest **1.8%/month**, interest withdrawal only after 3 months, **60-day notice** to return capital (F1–F5).
- Cooperative: help available after **12 consistent weeks**, amount capped at 50 weeks of contribution, **3 guarantors** required, admin approval, disbursed ≤2 days (G1–G4).
- Step-up auth (OTP or biometric) before payouts and transfers.
- Money writes are **disabled offline** (N3).

---

## Interactions & behaviour

- **Navigation**: tab bar for the five client destinations; push for detail; bottom sheets (marked ⧉ in screen names) for confirmations, filters, role switch and consent.
- **Auth**: email or phone + password; OTP over SMS or WhatsApp with a resend timer; biometric opt-in offered after the first successful password login (A7 / CA5), password always remains a fallback.
- **Failure copy is generic on purpose** (CA4-e says the pair is wrong, not which one), shows attempts remaining, and escalates to assisted recovery (AR5) after lockout.
- **Forms**: inline validation on blur; the primary CTA stays enabled and explains what's missing rather than disabling silently; phone fields use a `+234 ⌄` prefix with a divider.
- **Motion**: 150–250ms, ease-out for entrances, ease-in for exits; sheets slide from the bottom; skeleton shimmer (`cc-shimmer`, 320px sweep) for loading; spinners only where progress is unknown (`cc-spin`). Respect `prefers-reduced-motion`.
- **State pass** — every module inherits the four states drawn in N1–N4: loading (skeleton), empty (reason + one action), offline (banner + money writes blocked), error (money action, with a retry that is safe to press).

## State management

Application state the screens assume:

- `session` — device token (Sanctum), refresh, revocation per device; `biometricEnabled`, keychain token.
- `user` — Crux ID, name, avatar, `roles[]` (client / member / therapist / admin), active role context, membership tier.
- `wallet` — available balance, pending, ledger cursor, last server-quoted fee preview (never client-computed).
- `commitment` / `cooperative` / `rank` — cycle state, week counters, eligibility flags, guarantor statuses. All eligibility comes from the server; the UI only renders the returned gate.
- `cart` / `orders` — cart items, idempotent checkout, order timeline.
- `care` — appointments, session state (booked / confirmed / live / complete), unsent session notes queued offline, chat threads.
- `notifications` — inbox, unread count, per-category preferences, permission status (primed / granted / denied).
- `connectivity` — online flag driving N3 and the "money writes disabled" rule.

Data fetching: cursor pagination for lists; realtime over the Echo/Reverb channels for chat, live sessions and approvals.

## Assets

Everything in `design/assets/`:

| File | Use | Status |
| --- | --- | --- |
| `logo-mark.png`, `logo-md.jpg`, `logo-lg.jpg` | CruxCare leaf-and-hand mark | Brand asset — use the official files from the brand system |
| `screen-bg.png` | Botanical background behind authenticated screen headers | Placeholder art direction |
| `profile-cover.png` | Profile header cover (PR1) | Placeholder |
| `welcome-hands.png`, `welcome-leaf.png`, `welcome-living.png` | Onboarding slides A1a–A1c | Placeholder |
| `p-*.jpg` (6 files) | Product photography in the marketplace screens | Placeholder |
| `ta4-map.html` | Embedded OpenStreetMap used by TA4 (therapist location) | Reference only — use the app's real map SDK |

Fonts load from Google Fonts: Plus Jakarta Sans (400–800), IBM Plex Mono (400–600), Material Symbols Rounded. Bundle them locally for the app build.

**Background treatment:** authenticated screens carry `screen-bg.png` on the screen shell with an opaque content area, so the botanical shows only behind the header and in empty space. Headers sit on a white scrim (`linear-gradient(180deg, rgba(255,255,255,0.80), rgba(255,255,255,0.62) 55%, rgba(247,250,249,0.92))`) with dark text. Pre-login screens, dark screens (video visit, live room, lock screen) and PR1/PR2 are deliberately excluded.

## Screenshots

`screenshots/` holds a PNG of every screen at its design size (390 × 844, 1×), named by screen code — `CA1.png`, `CD3.png`, `E4.png` — matching the codes in SCREENS.md. 126 files.

## Files

In `design/` — open any file in a browser:

- `CruxCare Design Hierarchy.dc.html` — start here: file map, section map, primary paths
- `CruxCare Design System.dc.html` — tokens and components
- `CruxCare Auth and Account.dc.html` — auth, recovery, account, profile (29 screens)
- `CruxCare Client Dashboard.dc.html` — CD1–CD8
- `CruxCare Therapist Dashboard.dc.html` — TD1–TD8
- `CruxCare Phase 1 Screens.dc.html` — onboarding, homes, marketplace, care (26)
- `CruxCare Phase 2 Finance.dc.html` — wallet, commitment, cooperative, rank (18)
- `CruxCare Phase 3 Growth.dc.html` — network, earnings, notifications, account (10)
- `CruxCare Phase 4 Engagement.dc.html` — Point Facility, admin, state pass, push (19)
- `CruxCare Shared Features.dc.html` — SH1–SH7
- `support.js`, `image-slot.js` — prototype runtime only; do not port

In `reference/` — the source product documents the design was built from: `PRD-clean.md`, `DesignScope-clean.md`.

## Open items for the build team

- **Payment provider unconfirmed.** PR6 and CD3 assume a hosted card flow; card numbers never touch CruxCare servers.
- **Video provider unconfirmed.** CD4 and TD1 assume join-from-app with an audio-only fallback on mobile data.
- **Bronze and Silver earnings rates TBD.** Rank and network screens show tier positions without inventing rates.
- **Tablet layouts not drawn.** Two-pane at ≥768px (list + detail).
- **Photography is placeholder** throughout; final art direction pending.

## Suggested build order

1. Design tokens, typography, icon set, and the shell (status bar, tab bar, header, sheet).
2. Auth: A1–A7 / CA1–CA5, OTP, biometric opt-in, recovery (AR1–AR5).
3. Role model, home dashboards (B1–B4), role switch (K4), profile (PR1–PR6).
4. The state pass (N1–N4) as shared components — every module below depends on it.
5. Marketplace and checkout (C1–C6), care and booking (D1–D6, CD1–CD8).
6. Wallet and the money disclosure pattern (E1–E5) — build the server-quoted fee preview once, reuse for F, G and H.
7. Commitment, cooperative, rank, downline (F, G, H, J).
8. Notifications end-to-end (O1–O8), shared features (SH1–SH7), Point Facility (L), administration (M).
