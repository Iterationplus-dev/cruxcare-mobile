CRUXCARE
Crux Dynamic Care International Ltd.
Mobile App
Design Scope & UX Specification
Product:  CruxCare unified mobile application (iOS + Android)
Version:  Draft v1.0
Date:  August 2026
Audience:  UI/UX Designers · Frontend Engineers · Product · Claude Designs
Companion doc:  CruxCare Mobile — Product Requirements Document (PRD)
Implements with:  Ionic 8 components · Vue 3 / TypeScript · Tailwind-compatible tokens
Purpose:  A build-ready design brief: tokens, IA, screen inventory, flows & states for Claude Designs.
# 1. Design vision & principles
CruxCare helps people pursue a natural, "drugless" healthy lifestyle through products, therapist care, and a supportive member community. The mobile design should feel calm, trustworthy, and human—wellness-forward, not clinical, and never salesy despite the commerce and network features underneath.
## 1.1 Principles
Calm & natural—Generous whitespace, organic green/teal palette, rounded forms echoing the leaf-and-hand brand mark.
Clarity over density—One primary action per screen; money and health information shown plainly and honestly.
Trust in every transaction—Fees, lock periods, interest, and eligibility are always disclosed before an action is confirmed.
Role-aware, not role-cluttered—Each role sees only what it needs; multi-role users get a clean way to move between contexts.
Accessible by default—AA contrast, large touch targets, dynamic type, and screen-reader labels are requirements, not extras.
Native-feeling—Respect iOS and Android platform conventions through Ionic’s adaptive components.
# 2. Design tokens
Concrete, build-ready values. These map to Ionic CSS variables and Tailwind theme extensions, so Claude Designs and Frontend share one source of truth.
## 2.1 Color
| Token | Hex | Role |
| brand/primary | #0E7C6B | Primary actions, active nav, and key accents (teal). |
| brand/primary-dark | #0A5A4E | Pressed states, headings on light. |
| brand/leaf | #2FA36B | Positive/growth accents, success. |
| brand/sand | #F3EFE6 | Warm, neutral surface/cards. |
| brand/mist | #EAF3F0 | Subtle tinted background sections. |
| accent/amber | #C9772E | Warnings, financial caution, and highlights. |
| semantic/success | #2E9E5B | Confirmations, approved states. |
| semantic/warning | #C9772E | Locks, notices, at-risk. |
| semantic/danger | #C1443B | Errors, destructive actions. |
| semantic/info | #2B7DBD | Informational. |
| ink/900 | #1A2B22 | Primary text. |
| ink/600 | #2E3A33 | Body text. |
| ink/400 | #6B7A73 | Secondary text, captions. |
| line | #CBD8D2 | Borders, dividers. |
| surface/0 | #FFFFFF | Base surface. |
| surface/1 | #F7FAF9 | Elevated surface/list bg. |
| Dark mode Provide a dark theme by remapping surfaces to deep green-neutrals (surface/0 ≈ #0F1714) and lightening ink tokens; keep the brand/primary legible on dark by shifting to #34B79E for large text. Ship light first; dark as a fast follow. |

## 2.2 Typography
System font stack for native feel (SF Pro on iOS, Roboto on Android); a rounded display face is optional for headings.
| Style | Size/line | Weight | Use |
| Display | 28 / 34 | 700 | Screen titles, hero balances. |
| H1 | 22 / 28 | 700 | Section headers. |
| H2 | 18 / 24 | 600 | Card titles. |
| Body | 16 / 24 | 400 | Default text. |
| Body-strong | 16 / 24 | 600 | Emphasis, labels. |
| Caption | 13 / 18 | 400/500 | Meta, helper text. |
| Mono | 14 / 20 | 500 | Crux IDs, amounts, and codes. |

## 2.3 Spacing, radius, elevation
Spacing scale (px): 4, 8, 12, 16, 20, 24, 32, 40, 48. Base gutter 16; section gap 24.
Radius: sm 8, md 12, lg 16, pill 999. Cards use lg; buttons md; chips pill.
Elevation: e0 flat; e1 subtle card (y2 blur8 8% ink); e2 sheet/modal (y8 blur24 12% ink). Prefer tint + border over heavy shadow.
Touch targets: minimum 44×44 px; primary buttons full-width, 52 px tall.
# 3. Information architecture & navigation
Navigation is composed from the signed-in user’s capability set. The app uses a bottom tab bar (Ionic ion-tabs) with role-appropriate tabs, plus a "More" hub for less-frequent modules. Money and network features live under a single "Grow" or "Finance" hub to avoid tab overload.
## 3.1 Tab bars by role
| Role | Tab 1 | Tab 2 | Tab 3 | Tab 4 | Tab 5 |
| Client | Home | Shop | Care | Wallet | More |
| Member | Home | Shop | Grow* | Wallet | More |
| Therapist | Home | Clients | Care | Grow* | More |
| Admin | Home | Approvals | People | Wallet | More |

*"Grow" hub contains: Network (referrals/downline), Rank, Commitment, and Cooperative. "More" contains: Point Facility, Notifications, Profile, Settings, Support, and Role Switch.
## 3.2 Site map (module hierarchy)
App |- Onboarding: Welcome / Register / Link Crux ID (OTP) / Therapist plan |- Home (role dashboard) |- Shop: Catalog > Product > Cart > Checkout > Orders > Order detail |- Care (client): My therapist / Book appt / Chat / Video / Health profile / Care plans |- Clients (therapist): Roster > Case file > Appointments > Recommend > Chat/Video |- Grow |    |- Network: Referral link / Downline tree |    |- Rank: Current tier / Benefits / Next-tier progress |    |- Commitment: Overview / New commitment / Cycle detail / 60-day notice |    |- Cooperative: Account / Contribute / Request help / Guarantors / Transfers |- Wallet: Balance / Ledger / Withdraw / Transfer (fee preview) |- Point Facility: Centers / Session detail / Live room / Host tools |- Approvals (admin): Payouts / Help requests / Notices / Assign clients |- More: Notifications / Profile / Settings / Support
# 4. Screen inventory
The build-ready screen list is grouped by module. Each screen notes its primary job and key components. Claude Designs can treat each row as one artboard/flow node.
### 4.1 Onboarding & Account
| Screen | Primary job | Key components |
| Welcome / value intro | Orient & route to register/login. | Carousel, primary CTA |
| Register (Client) | Capture name/email/phone/password/referral source. | Form, select, validation |
| Link Crux ID | Enter Crux ID and start OTP. | Masked input, helper |
| OTP verify | Enter the SMS/WhatsApp code. | OTP input, resend timer |
| Therapist plan selected | Choose Free/Monthly/Yearly. | Plan cards, compare |
| Biometric opt-in | Enable fast unlock. | Toggle, system prompt |
| Login | Email/phone + password | Form, biometric shortcut |

### 4.2 Home dashboards
| Screen | Primary job | Key components |
| Client home | Quick actions: shop, book, chat, wallet | Greeting, action grid, cards |
| Member home | Rank snapshot, earnings, referrals, and CTA. | Rank card, stat tiles |
| Therapist home | Today’s appts, client requests, plan usage | Agenda list, alerts |
| Admin home | Pending approvals, assignments, system health | Queue counts, shortcuts |

### 4.3 Marketplace
| Screen | Primary job | Key components |
| Catalog | Browse/search/filter products. | Search bar, chips, grid |
| Product detail | Details, price, add to cart | Gallery, price, sticky CTA |
| Cart | Review items & totals. | Line items, totals, promo |
| Checkout | Delivery/pickup + pay | Address, method, summary |
| Order confirmation | Success + tracking entry | Status, receipt |
| Orders/Order Detail | History & status timeline | List, timeline |
| Order on behalf of the therapist/admin | Build an order for a client. | Client picker, cart |

### 4.4 Client care
| Screen | Primary job | Key components |
| Care hub | Assigned therapist, next visit, quick chat | Therapist card, actions |
| Find/request a therapist. | Request or get assigned | List, request flow |
| Book an appointment. | Pick a slot & confirm. | Calendar, slots |
| Health profile | Provide/update medical info and consent | Structured form, consent |
| Care plan select | Choose a visit cadence plan. | Plan cards |
| Chat thread | Real-time messaging + attachments | Bubbles, composer |
| Video call | Live session with consent | AV controls, consent sheet |

### 4.5 Therapist tools
| Screen | Primary job | Key components |
| Client roster | List within plan limits | List, plan usage bar |
| Case file | Notes, recommendations, history | Sections, attachments |
| New recommendation | Recommend spices/products | Product picker → order |
| Appointment manager | Accept/decline/reschedule | Calendar, request cards |
| Assignment inbox | Admin-assigned clients | List, accept |

### 4.6 Grow—Network & Rank
| Screen | Primary job | Key components |
| Referral link | Share the Crux-ID link/code. | QR, share sheet |
| Downline | Tree/list + counts per platform | Tree, filters |
| Rank overview | Current tier, scope, earnings, benefits | Rank card, benefit list |
| Next-tier progress | Target vs current + conditions | Progress, checklist |

### 4.7 Grow—Commitment
| Screen | Primary job | Key components |
| Commitment overview | Active cycles + accrued interest | Cards, totals |
| New commitment | Commit capital + terms disclosure. | Amount, terms sheet |
| Cycle detail | Principal, interest, lock end, actions | Stats, timeline |
| Withdraw interest | After 3 months, fee preview | Amount, fee, confirm |
| 60-day notice | Start capital-return notice. | Notice sheet, countdown |

### 4.8 Grow—Cooperative
| Screen | Primary job | Key components |
| Cooperative account | Weeks paid, savings type, status | Progress ring, stats |
| Contribute | Weekly/top-up (min $5) | Amount, schedule |
| Request help. | Eligibility + amount (post 12 weeks) | Eligibility, amount |
| Nominate guarantors. | Add 3 member guarantors. | Guarantor picker, status |
| Repayment status | Outstanding + auto-repay progress | Balance, progress |
| Transfer/withdraw | Member transfer & withdraw (5% fee) | Recipient, fee preview |

### 4.9 Wallet
| Screen | Primary job | Key components |
| Wallet home | Balances + quick actions | Balance hero, actions |
| Ledger | Transaction history w/ filters | List, filters |
| Withdraw | Amount + fee preview + confirm | Amount, fee, step-up auth |

### 4.10 Point Facility
| Screen | Primary job | Key components |
| Centers | Browse/join sessions (subscription gate) | Cards, schedule |
| Session detail | Type, host, time, join | Detail, join CTA. |
| Live room | Audio/video session | Stage, participants, controls |
| Host tools | Create center, list resources. | Form, resource list |

### 4.11 Admin
| Screen | Primary job | Key components |
| Approvals queue | Payouts, help, notices | Tabs, action cards |
| Assign clients | Route clients to therapists. | Picker, confirm. |
| Order for user | Place order on behalf | User picker, cart |

### 4.12 System & shared
| Screen | Primary job | Key components |
| Notifications | Inbox + preferences | List, category toggles |
| Profile | Identity, roles, Crux ID | Header, sections |
| Settings | Security, biometrics, language, theme | List rows, toggles |
| Support | Help & contact | FAQ, contact |
| Role switch | Move between role contexts. | Sheet, role list |

# 5. Key user flows
Critical paths are described as node sequences for Claude Designs to lay out as connected screens. Each "→" is a screen transition; "⧉" marks a confirmation/disclosure sheet.
### 5.1 Client onboarding → first order
START  Welcome  → Register (details + referral source)  → [verify]  → Client Home  → Shop Catalog  → Product  → Cart  → Checkout ⧉ fee/summary  → Order confirmation  → Orders
### 5.2 Member links Crux ID
START  Login/Register  → Link Crux ID  → OTP verify (SMS/WhatsApp)  → Member capabilities unlock  → Member Home (rank snapshot)
### 5.3 Book & attend therapy
START  Care Hub  → Find/request therapist  → [assigned]  → Book appointment (slot) ⧉ confirm  → reminder (push)  → Chat/Video call
### 5.4 The therapist creates a case file & recommends
START  Clients roster  → Client  → New case file  → Add notes  → New recommendation (product picker)  → Convert to Order on behalf  → Client notified
### 5.5 Commitment lifecycle
START  Commitment overview  → New commitment (amount) ⧉ terms: 1.8%/mo, 12-mo lock  → Cycle detail  → [after 3mo] Withdraw interest ⧉ 5% fee  → [later] 60-day notice  → admin approves  → capital+interest paid  → start new cycle
### 5.6 Cooperative help request
START  Cooperative account  → [12 weeks consistent] Help button  → Request help (amount ≤ 50-week cap)  → Nominate 3 guarantors  → guarantors approve  → admin approves  → disbursed ≤2 weeks  → auto-repay via contributions
### 5.7 Withdrawal with fee
START  Wallet  → Withdraw (amount) ⧉ fee preview (min 5%)  → step-up auth (OTP/biometric)  → processing  → ledger updated
### 5.8 Point Facility live session
START  Point Facility Centers  → [subscription gate]  → Session detail  → join ⧉ recording consent  → Live room
# 6. Component library
Reusable components mapped to Ionic primitives. Build these once; compose screens from them.
| Component | Ionic / base | Notes |
| AppTabBar | ion-tabs | Role-composed; badges for notifications/approvals. |
| PageHeader | ion-header/ion-toolbar | Title, back, and contextual actions. |
| PrimaryButton | ion-button | Full-width 52px; loading & disabled states. |
| MoneyAmount | custom | Currency-aware, mono, server value only. |
| FeeDisclosureSheet | ion-modal (sheet) | Shows fee/lock/terms before confirming. |
| StatTile | ion-card | Label + value + trend; used on dashboards. |
| RankCard | ion-card | Tier badge, scope, earnings, benefits. |
| ProgressToTarget | ion-progress-bar | Referral/repayment/weeks progress. |
| ProductCard | ion-card | Image, name, price, and add-to-cart. |
| CaseFileSection | ion-list/ion-item | Collapsible notes/recommendations. |
| ChatComposer | custom + ion-input | Attachments, send, and typing indicator. |
| VideoStage | custom (WebRTC SDK) | Tiles, AV controls, and participant list. |
| GuarantorPicker | ion-modal | Search members by Crux ID and status chips. |
| OtpInput | custom | Segmented code, resend timer. |
| EmptyState | custom | Icon + message + CTA. |
| StateBanner | ion-toast/ion-banner | Offline / error / last-updated. |

# 7. States, feedback & edge cases
Every data screen designs four states. Financial and health screens get extra care.
| State | Design requirement |
| Loading | Skeletons matching the final layout; never a bare spinner on primary content. |
| Empty | Friendly illustration + one clear CTA (e.g., "No orders yet—browse the shop"). |
| Error | Plain-language message + retry; preserve entered data; log to observability. |
| Offline | Show cached data with "last updated" and a persistent banner; disable money writes. |
| Gated | Explain why (plan/rank/subscription) and how to unlock (e.g., cooperative help before 12 weeks). |
| Pending approval | Clear status + expected timeline (e.g. 60-day notice countdown, help ≤2 weeks). |
| Success | Confirmation with receipt/reference and next step; celebratory but restrained. |
| Financial honesty rule Before any money action, show a disclosure sheet with the exact amount, the fee (min 5% where applicable), any lock/notice period, and the resulting balance—all from the server. No optimistic UI that implies success before the server confirms. |

# 8. Accessibility & inclusivity
Contrast—Meet WCAG 2.1 AA (4.5:1 text, 3:1 large text/icons). Verify the brand teal on white and on tinted surfaces.
Dynamic type—Supports OS text scaling up to 200%; layouts reflow, no clipping.
Touch—Minimum 44×44 px targets; adequate spacing between actions.
Screen readers—All controls labeled; money/amounts read meaningfully; live regions for status changes.
Motion—Respect reduced-motion; no essential info conveyed by motion alone.
Language—Plain language for financial and health concepts; avoid jargon; externalize copy for future localization.
Elder-friendly—Point Facility serves elderly units—offer larger-text mode and simple audio-first flows.
# 9. Handoff for Claude Designs & Frontend
## 9.1 What to produce
A token file (colors, type, spacing, radius, elevation) from §2, as CSS variables + Tailwind theme, wired to Ionic variables.
A component set (§6) with light + dark and all states from §7.
Screen designs for the inventory in §4, prioritized by the PRD roadmap (Phase 1 first: onboarding, shop, care).
Prototyped flows from §5 for the critical paths (onboarding→order, book→care, commitment, and cooperative help).
## 9.2 Build order (mirrors PRD phases)
| Phase | Design deliverables |
| 1 — Care + Commerce | Tokens, core components, onboarding, Home (client/therapist), Shop, Care, and Chat. |
| 2 — Finance | Wallet, Commitment, and Cooperative screens + fee/terms disclosure sheets. |
| 3 — Growth | Network, rank, earnings, and notifications depth. |
| 4 — Engagement | Point Facility live room, video call UI, offline/empty polish. |

## 9.3 Guardrails for AI Implementation
Use Ionic components before custom ones; keep platform-adaptive behavior on.
Never display a client-computed financial value as actionable—bind to server responses.
Gate every role/plan/subscription feature in the UI, but treat the server as the enforcer.
Keep health/case-file screens behind auth + consent; no caching of sensitive health data beyond session unless encrypted.
End of Design Scope. Pair with the "CruxCare Mobile—PRD" for functional requirements, business rules, data model, and API surface.