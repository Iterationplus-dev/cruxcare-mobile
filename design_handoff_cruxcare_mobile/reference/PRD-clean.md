CRUXCARE
Crux Dynamic Care International Ltd.
Mobile App
Product Requirements Document (PRD)
Product:  CruxCare unified mobile application (iOS + Android)
Version:  Draft v1.0
Date:  August 2026
Status:  For engineering, design & QA planning
Audience:  Product · UI/UX · Frontend · Backend · QA · DevOps · AI coding assistants
Stack:  Ionic + Vue 3 / TypeScript (Capacitor) · Laravel API · existing MySQL · Redis
Companion doc:  CruxCare Mobile — Design Scope & UX Specification
# 1. Overview
## 1.1 Product summary
CruxCare is a health-and-wellness ecosystem operated by Crux Dynamic Care International Ltd. (cruxcintl.com). It combines a natural-products marketplace, a therapist-led client care service, and three community finance/growth platforms—Basic Network (referral membership), Commitment (member investment), and Cooperative (weekly savings and mutual help)—unified by a seven-tier member ranking system.
This PRD defines a single mobile application that surfaces all CruxCare products and services to clients, members, therapists, and admins on iOS and Android. The web platforms already exist; the mobile app is a new client that consumes a Laravel API layer over the existing MySQL database, with Redis powering cache, queues, sessions, and real-time. The mobile app does not reimplement business logic—it exposes existing logic through a versioned, mobile-first API and adds device-native capabilities (push, camera, biometrics, and offline caching).
## 1.2 Goals
Unify—Bring Marketplace, Client Care, Basic Network, Commitment, Cooperative, Ranking, and Point Facility into one coherent mobile experience with role-aware navigation.
Reuse—Wrap existing web business logic behind a stable REST API; avoid duplicating or forking financial rules.
Trust—Handle money movement and health information with strong auth, auditability, and encryption.
Engage—Drive retention through push notifications, therapist chat/video, and the Point Facility live sessions.
Ship AI-ready specs—Structure this PRD and the companion Design Scope so Claude Code can implement the app and API, and Claude Designs can produce the UI directly from them.
## 1.3 Non-goals (for v1)
Rebuilding or migrating the existing web admin back-office (mobile consumes the same APIs, but the full admin console remains web-first).
Changing any financial business rule, interest rate, or ranking threshold—these are inherited as-is and only surfaced.
Public unauthenticated marketplace browsing SEO—the mobile app is an authenticated/guest client, not a web storefront.
New MLM/compensation math beyond what the ranking system already defines.
| Optimization note The source brief mixed the terms "investment/investor" and "commitment/committer" and "Investment/Patient Treatment" vs. "Commitment/Client Care" for the platform names. Per the brief’s own instruction, this PRD standardizes on Commitment/Committer and Cooperative/Client Care throughout. Ambiguities (e.g. undefined "Crux II/5/6 membership status" and TBD earnings for Bronze/Silver) are captured in §16 Open Questions rather than invented. |

# 2. Personas & roles
The app is strongly role-aware. A single account may hold more than one role (e.g. a member who is also a therapist and a committer). The API returns a capability/role set on login; the UI composes navigation from it.
| Role | Who they are | Primary jobs-to-be-done |
| Guest | Unregistered visitor | Browse the limited marketplace, learn about CruxCare, and register. |
| Client | Registered user, not necessarily a member | Order products, book/receive therapist care, chat, manage health info, and join Point Facility. |
| Member | Basic Network member with a Crux ID (e.g., CCI8804XO) | Refer others, track downline & rank, join Cooperative & Commitment, and earn. |
| Therapist | Member on an active therapist plan (free/monthly/yearly) | Manage clients & case files, accept appointments, recommend products, run Point Facility, and earn commissions. |
| Admin | Administrative arm of Crux Dynamic | Assign clients to therapists, register/order on behalf of users, and approve financial actions. |
| Super Admin | Default top-level administrator | Full system control and configuration (largely web; mobile surface approvals & monitoring). |

## 2.1 Role capability matrix
"✓" = available, "○" = partial / plan-gated, "—" = not available.
| Capability | Guest | Client | Member | Therapist | Admin |
| Browse the marketplace. | ○ | ✓ | ✓ | ✓ | ✓ |
| Place orders. | — | ✓ | ✓ | ✓ | ✓ |
| Book appointments. | — | ✓ | ✓ | ✓ | ✓ |
| Provide medical/health info. | — | ✓ | ✓ | — | — |
| Case files (create/manage) | — | — | — | ○ | ✓ |
| Referrals/downline | — | — | ✓ | ✓ | ✓ |
| Cooperative savings & help | — | — | ✓ | ✓ | ✓ |
| Commitment (invest) | — | — | ✓ | ✓ | ✓ |
| Ranking & earnings | — | — | ✓ | ✓ | ✓ |
| Point Facility (attend) | — | ○ | ○ | ✓ | ✓ |
| Point Facility (host/list) | — | — | ○ | ✓ | ✓ |
| Assign clients to therapists. | — | — | — | — | ✓ |
| Approve financial payouts. | — | — | — | — | ✓ |

# 3. System context & architecture
## 3.1 High-level architecture
The mobile app is a Capacitor-packaged Ionic + Vue 3 (TypeScript) client. It talks only to a versioned Laravel REST API (/api/v1). The API is the single integration surface over the existing MySQL schema and shared services. Redis backs cache, queues, sessions, and broadcasting. Real-time (chat, presence, Point Facility signaling, payout status) is delivered over WebSockets via Laravel Echo.
[ iOS / Android app ] Ionic + Vue 3 + TypeScript (Capacitor)        | HTTPS (REST, JSON) + WSS (Echo/Reverb)        v  [API Gateway: Laravel /api/v1] Sanctum tokens, RBAC, rate limit, versioning        |            |            |        v            v            v   [ MySQL ] [ Redis ]   [ Queues/Workers ]   -> cache, sessions, broadcast, jobs        |            |        +----- shared domain services (orders, finance, ranking) -----+        |  [ External: payments, SMS/WhatsApp OTP, push (FCM/APNs), video SFU ]
## 3.2 Client tech stack
| Concern | Choice | Notes |
| Shell | Ionic Framework 8 + Capacitor 6 | Single codebase → iOS + Android + PWA fallback. |
| UI runtime | Vue 3 + TypeScript (script setup) | Composition API; strict TS. |
| State | Pinia | Stores per domain (auth, cart, finance, care, network). |
| Routing | Vue Router (Ionic Router) | Role-guarded routes; tab + stacked nav. |
| HTTP | Axios + typed API client | Interceptors for auth token, refresh, and error normalization. |
| Realtime | Laravel Echo + Pusher-protocol (Reverb) | Private + presence channels. |
| Forms/validation | VeeValidate + Zod (or Yup) | Shared schemas mirror API validation. |
| Native | Capacitor plugins | Push, Camera, Biometrics, Secure Storage, Filesystem, Network. |
| Video | WebRTC via SFU SDK (see §16) | Agora / Twilio / Daily / LiveKit—to be selected. |
| i18n | vue-i18n | English v1; currency-aware formatting. |

## 3.3 Backend stack (existing, extended for mobile)
| Concern | Choice | Notes |
| Framework | Laravel (existing) | Add /api/v1 mobile controllers; reuse domain services. |
| Auth | Laravel Sanctum (token abilities) | Personal access tokens per device; ability scopes = capabilities. |
| Cache/queue/session | Redis | Cache tags, queued jobs (payouts, notifications, and interest accrual), and broadcast backplane. |
| DB | MySQL (existing) | Reuse schema; add mobile-only tables (§12.3). |
| Broadcast | Laravel Reverb (or Pusher) | Redis-backed; Echo on client. |
| Scheduling | Laravel Scheduler + Horizon | Interest accrual, notice of maturity, and contribution reminders. |
| Files/media | S3-compatible storage | Case-file attachments, product images, and Point Facility recordings. |
| Backend principle Mobile endpoints are thin adapters. Financial calculations (interest, cooperative help eligibility, ranking thresholds, and withdrawal charges) must call the same shared services the web uses. No money math is duplicated in the mobile controllers or the client. The client never computes balances it can act on—it displays server-authoritative values. |

# 4. Cross-cutting product requirements
## 4.1 Authentication & onboarding
Client sign-up—First name, last name, email, password, phone, and a "Referred by" source (Facebook, WhatsApp, member, therapist, admin, Google Ads, friends & family, others). No membership required to be a client.
Member linking—A member links their existing Crux ID (format CCI8804XO / CCIAB012C). The app verifies the associated email or phone via SMS or WhatsApp OTP.
Therapist activation—Must already be a member. Enter the Crux ID, verify email/phone, and then choose a therapist plan (Free Trial / Monthly / Yearly) to activate therapist capabilities.
Login—Email/phone + password; optional biometric unlock after first login (Capacitor Biometrics + secure token storage).
Session—Sanctum device token with refresh; server can revoke per device. Sensitive actions (payout, transfer) may require re-authentication or an OTP step-up.
## 4.2 Wallet, money & charges (global rules)
Money appears across Marketplace, Commitment, Cooperative, and Ranking earnings, so a shared Wallet concept centralizes balances and ledgers.
All balances and transaction history are server-authoritative and read via the Wallet API.
Admin collects a minimum 5% charge on all withdrawals and on member-to-member transfers (cooperative). Charge computation lives server-side; the client shows a fee preview returned by the API before confirmation.
Multi-currency: the brief quotes are in USD. The app formats currency from server-provided currency codes; a single display currency per account in v1 (see §16).
Every money movement produces an immutable ledger entry with an idempotency key to prevent double submission on mobile networks.
## 4.3 Notifications
Channels: push (FCM/APNs via Capacitor), in-app inbox, and SMS/WhatsApp for OTP and critical financial events.
Event examples: appointment requests/reminders, help-request approvals, payout maturity (60-day notice), contribution due, rank promotion, order status, and chat/Point Facility invites.
User-manageable notification preferences per category.
## 4.4 Offline & resilience
Read-through cache of catalog, profile, rank status, and ledgers for offline viewing; clearly marked as "last updated".
Write actions queue with idempotency keys and retry when connectivity returns; financial writes never silently retry without server confirmation.
Network state banner; graceful empty/error/loading states (defined in the Design Scope).
## 4.5 Security, privacy & compliance
Health data—Client medical/health info and case files are sensitive. Encrypt in transit (TLS) and at rest; strict RBAC so only the assigned therapist and authorized admins can access a client’s case file.
Least privilege—The Sanctum token abilities map to the capability matrix (§2.1); the server enforces, and the client only hides.
Auditing — All financial approvals, case-file access, and admin actions are audit-logged.
Secrets on device—Tokens in secure storage/keychain; no sensitive data in plain local storage.
Consent — Explicit consent capture for health data and for Point Facility recording.
# 5. Epic A — Onboarding, Accounts & Roles
Register, authenticate, link membership, and activate roles.
### User stories & acceptance criteria
A1:  As a visitor, I can register as a client with my details and a referral source so I can start using CruxCare.
Acceptance criteria:
Required: first/last name, email, password, phone, referred-by source.
Email uniqueness validated server-side; friendly inline errors.
On success, I am logged in and land on the role-appropriate home.
A2:  As a member, I can link my Crux ID and verify via SMS/WhatsApp OTP so my membership features unlock.
Acceptance criteria:
Crux ID format validated (e.g. CCI####XX / CCIAB###C).
OTP sent to the account’s existing email or phone: 3 attempts, expiry, and resend cooldown.
On verify, member capabilities appear without re-logging.
A3:  As a member, I can activate as a therapist by choosing a plan so I can manage clients.
Acceptance criteria:
Plans: Free Trial ($0, 1 client / 1 case file, unlimited purchases), Monthly ($15/mo or admin-listed), Yearly ($200/yr or admin-listed).
Plan limits enforced server-side; UI reflects current plan and usage.
Downgrade/expiry gracefully restricts to free trial limits without data loss.
A4:  As any user, I can log in with biometrics after first login, so access is fast and secure.
Acceptance criteria:
Opt-in after first successful password login.
Fallback to password; token stored in secure enclave/keychain.
A5:  As a user with multiple roles, the app composes my navigation from my capability set.
Acceptance criteria:
Login returns roles and abilities; the tab bar and menus derive from them.
Role switch (if applicable) does not require re-login.
# 6. Epic B — Marketplace & Orders
A general store where users order CruxCare natural products and services, directly or via a therapist.
### User stories & acceptance criteria
B1:  As a client, I can browse and search products/services with categories and details.
Acceptance criteria:
Catalog served from existing product data via API; images from CDN/S3.
Search, category filter, sort; product detail with description, price, and availability.
B2:  As a client, I can add to cart and place an order with a delivery/pickup option.
Acceptance criteria:
Cart persists per user; the server recalculates totals and stock at checkout.
Order confirmation with status timeline; idempotent submission.
B3:  As a client, I can order through my therapist, or a therapist can order on my behalf.
Acceptance criteria:
A therapist can build an order attributed to a client (within plan limits).
The client is notified and can view therapist-initiated orders.
B4:  As a therapist, I make unlimited purchases regardless of plan tier.
Acceptance criteria:
Purchase capability not gated by free trial limits (only client/case-file counts are).
B5:  As an admin, I can order products for clients or therapists.
Acceptance criteria:
Admin order attribution recorded and audit-logged.
| Reuse Pricing, tax, stock, and fulfillment come from existing web commerce services. Mobile adds cart UX, native checkout, and order tracking only. |

# 7. Epic C — Client Care (Therapy)
Therapist-led care: case files, appointments, recommendations, chat/video, and care subscription plans.
### Client-side stories
C1:  As a client, I can provide and update my medical/health information securely.
Acceptance criteria:
Structured health profile; encrypted; visible only to assigned therapist & authorized admin.
Explicit consent captured and versioned.
C2:  As a client, I can book appointments with a therapist or admin.
Acceptance criteria:
See availability, request slot; receive confirmation & reminders.
Statuses: requested → confirmed → completed/cancelled / no-show.
C3:  As a client, I can request the services of a therapist and be assigned one.
Acceptance criteria:
Request routed to therapist or to admin for assignment.
Notified on assignment; assigned therapist appears in my care hub.
C4:  As a client, I can chat and video-call my therapist or admin.
Acceptance criteria:
Real-time chat (Echo), attachments, read receipts, and presence.
Video session launch with consent; see §16 for provider.
C5:  As a client, I can subscribe to a care plan.
Acceptance criteria:
Plans: 1×/wk visit for 1 month; 2×/wk for 3 months; 3×/wk for 6 months; 3×/wk for 1 year; custom.
Plan drives scheduling cadence and billing.
### Therapist-side stories
C6:  As a therapist, I can create and manage case files for my clients.
Acceptance criteria:
Case file: client link, health context, notes, recommendations, session history, attachments.
Count limited by plan (Free Trial = 1); enforced server-side.
C7:  As a therapist, I receive appointment requests and manage my schedule.
Acceptance criteria:
Accept/decline/reschedule; calendar view; reminders.
C8:  As a therapist, I recommend spices/products and provide health solutions & therapy.
Acceptance criteria:
Recommendations attached to the case file and can convert to an order (Epic B).
C9:  As a therapist, I receive client assignments from admins.
Acceptance criteria:
Assignment notification; client appears in my roster (within plan limits).
C10:  As a therapist, I can control Point Facility centers and act as a training/care outlet.
Acceptance criteria:
Links to Epic F; gated by rank/plan.
# 8. Epic D — Basic Network (Referral Membership)
The existing membership system: members refer others, hold a Crux ID, and grow a downline that feeds ranking.
### Business rules
Membership registration is performed on the website by an admin or through an outlet; the app links an existing Crux ID (it does not create new memberships in v1).
A member is expected to refer at least 2 others to join the platform.
Referrals across all four platforms accumulate toward ranking (§11).
### User stories & acceptance criteria
D1:  As a member, I can view my Crux ID and referral link/code and share it.
Acceptance criteria:
Deep-link / share sheet with attribution to my Crux ID.
D2:  As a member, I can see my downline and referral count.
Acceptance criteria:
Downline tree/list with counts per platform; server-authoritative.
D3:  As a member, I can track progress toward my next rank.
Acceptance criteria:
Progress bar vs. the referral target of the next tier (§11).
# 9. Epic E—Commitment (CPE Investment)
A financial module (not a separate user system) where members commit capital toward CruxCare equipment/products and earn interest.
### Business rules (authoritative)
| Rule | Value/behavior |
| Instrument | The committer commits capital to "purchase" CruxCare equipment/products. |
| Interest | 1.8% per month, accrued server-side. |
| Capital lock | Locked for a defined period (e.g., 12 months). |
| Interest withdrawal | Allowed only after 3 months. |
| Capital return | The committer places a 60-day notice; admin approves; the system pays capital + remaining interest (automated). |
| Cycle end | Earnings stop once capital is returned; the committer may start a new commitment cycle. |
| Eligibility | Must be a Basic Network member (has a Crux ID); commitment is a module, not a separate account. |

### User stories & acceptance criteria
E1:  As a member, I can open a commitment by committing capital.
Acceptance criteria:
Amount entry with confirmation of lock period and terms; server records cycle start.
Idempotent; ledger entry created.
E2:  As a Committer, I can view accrued interest and cycle status.
Acceptance criteria:
Shows principal, accrued interest (1.8%/mo), lock end date, and next milestones.
Values server-authoritative; the client never computes accrual it acts on.
E3:  As a Committer, I can withdraw interest only after 3 months.
Acceptance criteria:
Withdraw disabled/explained before the 3-month mark.
Withdrawal applies a global 5% minimum charge (§4.2).
E4:  As a Committer, I can place a 60-day notice to reclaim capital.
Acceptance criteria:
Notice starts a 60-day timer; status visible; admin approval required.
On maturity and approval, capital and remaining interest are paid automatically; earnings stop.
E5: As a Committer, after a capital return, I can start a new cycle.
Acceptance criteria:
Prior cycle archived in history; new cycle independent.
| Compliance flag Commitment offers a fixed monthly return and may constitute a regulated financial product in some jurisdictions. Legal/compliance review of disclosures, KYC, and licensing is required before launch (§16). |

# 10. Epic F — Cooperative (Weekly Savings & Help)
A 52-week cooperative where members contribute weekly and can receive "help" (an advance/loan) against contributions, with guarantors.
### Business rules (authoritative)
Same registration rules as Commitment (member with valid Crux ID).
Weekly contribution: any amount within member capacity, minimum $5.
Active year = 52 weeks. Max help anyone can receive = 50 weeks of value; 2 weeks go to admin as an administrative charge.
Qualification: consistent contribution for 12 weeks unlocks the Help button; help is repaid as the member continues weekly contributions (contribution = automatic debt repayment).
Guarantors: 3 required, each a CruxCare member with a valid Crux ID.
Fulfillment: qualified members can receive help within 2 weeks of requesting.
Savings type: Open savings can receive help (loan); closed savings cannot get help but earn interest at year-end.
Year-end interest: members who never requested help/loan get 10% additional interest on the year’s savings under closed savings and 0% under open savings.
Referrer bonuses come from interest collected (the 2 admin weeks & interest paid to closed-savings members).
Members can add or increase their contribution at any time.
Admin collects a minimum of 5% on all withdrawals and on member-to-member transfers.
### User stories & acceptance criteria
F1:  As a member, I can join the cooperative and choose open or closed savings.
Acceptance criteria:
Savings type selected at join; drives help eligibility & interest.
F2:  As a member, I can make or increase weekly contributions (min. $5).
Acceptance criteria:
Contribution ledger tracks weeks & consistency; can top up anytime.
F3:  As a qualified open-savings member, I can request help with 3 guarantors.
Acceptance criteria:
The Help button appears only after 12 consistent weeks (Open Savings).
Must nominate 3 member guarantors (valid Crux IDs) who approve.
On approval, help disbursed within 2 weeks; capped at 50-week value; 2-week admin charge applied.
F4:  As a member with help, my weekly contributions automatically repay it.
Acceptance criteria:
Repayment progress visible; outstanding balance server-authoritative.
F5:  As a closed-savings member with no help taken, I earn 10% year-end interest.
Acceptance criteria:
Interest computed and credited at 52-week close.
F6:  As a member, I can transfer to another member and withdraw (with a 5% min charge).
Acceptance criteria:
Fee preview before confirmation; recipient validated by Crux ID.
F7:  As a referrer, I receive bonuses from cooperative interest pools.
Acceptance criteria:
Bonus attribution visible in earnings; sourced per rules above.
# 11. Epic G—Member Ranking System
A seven-tier progression (plus a life director retirement tier) rewarding referrals across the four platforms with monthly earnings, scope, and benefits.
### Ranking overview
| Level | Award & position | Referral target | Monthly earnings | Scope |
| 7 | Ambassador—Continent Ambassador | 5,000+ | $1,000/mo | Continent |
| 6 | Emerald—Country Head | 3,050 | $500/mo | Country |
| 5 | Platinum — Regional Coordinator | 1,050 | $100/mo | Regional |
| 4 | Diamond—State Coordinator | 305 | $50/mo | State |
| 3 | Gold — District Coordinator | 115 | $10/mo | District |
| 2 | Silver—Area Coordinator | 45 | TBD | Area |
| 1 | Bronze — Unit Leader | 15 | TBD | Unit |

Life Director (Retirement Tier): Level 7 Continent Ambassadors who retire are automatically elevated to Life Director—retaining recognition, receiving annual revenue-share distributions across all platforms, and remaining an honorary figurehead.
### Rules & notes
Referral targets accumulate across all four platforms (Basic Network, Cooperative, Commitment, and Client Care).
Some tiers carry additional conditions in the brief (e.g., Diamond requires ≥1 "Crux II" member from Basic Network; higher tiers reference "Crux 5/6" membership status). These membership sub-levels are undefined in the brief—see §16.
Bronze & Silver monthly earnings are to be confirmed.
### User stories & acceptance criteria
G1:  As a member, I can see my current rank, benefits, and responsibilities.
Acceptance criteria:
Rank card with tier, scope, monthly earnings, and benefits list.
G2:  As a member, I can see progress and requirements toward the next tier.
Acceptance criteria:
Referral progress vs. target; any special conditions surfaced.
G3:  As a member/admin, monthly earnings tied to rank are reflected in the wallet.
Acceptance criteria:
Earnings credited per server rules; visible in ledger.
# 12. Epic H—Point Facility
A platform where qualified ranking members engage clients/elderly ("units") through live video/audio for companionship, wellness, and encouragement.
### Business rules
Qualified ranking members (and therapists) host sessions; clients must subscribe to a plan to attend.
Session/resource types: entertainment, gospel preaching, games/play, words of encouragement, fundraising, singing, health exercises, testimony ward, trainings, elder-to-elder communication, and other engagement.
Therapists or qualified members list resources on a Point Facility center.
### User stories & acceptance criteria
H1:  As a qualified member/therapist, I can create a Point Facility center and list resources/sessions.
Acceptance criteria:
The center has a schedule, session type, and capacity, gated by rank/plan.
H2:  As a subscribed client, I can browse and join live audio/video sessions.
Acceptance criteria:
Subscription gate enforced; join via real-time signaling; consent to recording.
H3:  As a host, I can upload some free resources for clients to access.
Acceptance criteria:
Presence, mute/AV controls, optional recording to S3 or Cloudinary, moderation.
H4:  As a host, I can run live sessions with participants.
Acceptance criteria:
Presence, mute/AV controls, optional recording to S3/Cloudinary, moderation.
# 13. Data model (mapping over existing MySQL)
The mobile app reuses the existing schema. This section names the core entities the API must expose and the mobile-only additions. The backend owns field-level schemas; below is the contract-level view for Claude Code to scaffold DTOs and stores.
## 13.1 Core entities (existing/shared)
| Entity | Key attributes (contract-level) | Relationships |
| User | id, name, email, phone, roles[], referredBySource, cruxId? | 1–* orders, appointments; has Wallet |
| Membership | cruxId, tier, memberSubLevel, joinedAt | belongs to User; feeds Ranking |
| TherapistProfile | plan(free/monthly/yearly), status, limits | belongs to User(member) |
| Product | id, name, description, price, currency, stock, media[] | in Orders |
| Order | id, items[], total, status, placedBy, onBehalfOf? | User, Therapist/Admin |
| Appointment | id, clientId, providerId, slot, status | Client ↔ Therapist/Admin |
| CaseFile | id, clientId, therapistId, notes[], recommendations[], attachments[] | Therapist ↔ Client |
| HealthProfile | clientId, structured medical info, consentVersion | belongs to Client |
| Referral | referrerCruxId, refereeId, platform, createdAt | User → User (downline) |
| Commitment | id, memberId, principal, rateMonthly, lockEnd, noticeAt?, status | belongs to Member |
| CoopAccount | id, memberId, savingsType(open/closed), weeksPaid | belongs to Member |
| CoopContribution | accountId, amount, week, at | belongs to CoopAccount |
| CoopHelp | accountId, amount, guarantors[3], status, outstanding | CoopAccount + guarantors |
| Rank | memberId, level, scope, monthlyEarning | derived from Referrals |
| Wallet | userId, balances[], ledger[] | belongs to User |
| Transaction | id, walletId, type, amount, fee, idempotencyKey, ref | ledger entry |
| PointCenter | id, hostId, resources[], schedule, plan gate | Host + subscribers |

## 13.2 Subscriptions & plans
TherapistPlan: free/monthly ($15) / yearly ($200)—limits on clients & case files.
CarePlan (client): visit cadence × duration presets + custom.
PointFacilityPlan: access gate for attending sessions.
## 13.3 Mobile-only additions
DeviceToken: userId, platform, token, lastSeen — for push.
ChatThread / ChatMessage: participants, body, attachments, readReceipts — realtime care chat.
VideoSession: appointment/center link, provider room id, consent, recordingRef.
NotificationPreference: userId, category, channels.
OutboxRequest (client-side): idempotency key + payload for queued offline writes.
# 14. API surface (REST /api/v1)
Representative endpoints for Claude Code to scaffold controllers, routes, and typed client methods. All authenticated via Sanctum; abilities enforce the capability matrix. Conventions: JSON, cursor pagination, ISO-8601, idempotency-key header on money writes, and ETag caching for catalog.
### Auth & account
POST   /auth/register            — client sign-upPOST   /auth/login               — email/phone + passwordPOST   /auth/otp/request         — SMS/WhatsApp OTP (member/therapist verify)POST   /auth/otp/verifyPOST   /auth/biometric/enablePOST   /auth/logoutGET    /me                       — profile, roles, abilitiesPATCH  /mePOST   /me/membership/link       — link Crux IDPOST   /me/therapist/activate    — choose plan
### Marketplace & orders
GET    /products                 — search, filter, paginateGET    /products/{id}GET    /cart  |  POST /cart/items  |  DELETE /cart/items/{id}POST   /orders                   — idempotent checkoutGET    /orders  |  GET /orders/{id}POST   /orders/on-behalf         — therapist/admin order for client
### Client care
GET    /appointments  |  POST /appointments  |  PATCH /appointments/{id}GET    /therapists  |  POST /care/requests   — request a therapistGET    /case-files  |  POST /case-files  |  PATCH /case-files/{id}GET    /health-profile  |  PUT /health-profile (+ consent)GET    /care/plans  |  POST /care/subscriptionsGET    /chat/threads  |  GET /chat/threads/{id}/messages  |  POST .../messagesPOST   /video/sessions  |  POST /video/sessions/{id}/token
### Network, commitment, cooperative, ranking, wallet
GET    /network/downline  |  GET /network/referral-linkGET    /commitments  |  POST /commitments  |  POST /commitments/{id}/noticePOST   /commitments/{id}/interest/withdrawGET    /coop/account  |  POST /coop/contributions  |  POST /coop/helpPOST   /coop/help/{id}/guarantors  |  POST /coop/transfersGET    /rank  |  GET /rank/nextGET    /wallet  |  GET /wallet/ledger  |  POST /wallet/withdrawals
### Point Facility, notifications, admin
GET    /point/centers  |  POST /point/centers  |  POST /point/centers/{id}/resourcesPOST   /point/centers/{id}/joinGET    /notifications  |  PATCH /notifications/prefs  |  POST /devices/tokenPOST   /admin/assign-client  |  POST /admin/approvals/{id}  (payouts, help, notices)
# 15. Non-functional requirements
| Category | Requirement |
| Performance | Cold start < 3s on mid-range Android; list screens interactive < 1s from cache; API p95 < 400ms for reads. |
| Scalability | Redis-backed cache & queues; horizontal API workers; broadcasting via Reverb cluster. |
| Reliability | Idempotent money writes; queued retries; graceful offline; crash-free sessions > 99.5%. |
| Security | TLS everywhere; encrypted health data at rest; Sanctum ability scopes; step-up auth for money actions; audit logs. |
| Privacy | Consent capture; data minimization; per-role access to health/case data; export/delete on request. |
| Accessibility | WCAG 2.1 AA targets; dynamic type; screen-reader labels; ≥44px touch targets (detailed in Design Scope). |
| Observability | Structured logs, request tracing, financial event metrics, client crash/analytics SDK. |
| Localization | English v1; currency-aware formatting; copy externalized via vue-i18n. |
| Compatibility | iOS 15+, Android 8+ (API 26+). |
| Maintainability | Strict TypeScript; typed API client generated from OpenAPI; domain-oriented Pinia stores. |

# 16. Delivery roadmap (phased)
| Phase | Scope | Exit criteria |
| 0 — Foundations | API gateway (/api/v1), Sanctum auth, RBAC, design system, CI/CD, and push scaffolding. | The app shell installs on iOS/Android, login works, and design tokens live. |
| 1 — Care + Commerce | Onboarding (A), Marketplace (B), Client Care core (C1–C8), Wallet read. | A client can register, order, book, & chat with a therapist. |
| 2 — Finance | Commitment (E), Cooperative (F), Wallet writes, charges, and approvals. | Members can commit, contribute, and request help; payouts flow with fees. |
| 3 — Growth | Basic Network (D), Ranking (G), earnings, and notifications depth. | Downline, rank progress, and earnings are visible & correct. |
| 4 — Engagement | Point Facility (H) incl. live video, care video calls, and offline polish. | Live sessions & video calls stable; offline read/queue verified. |

# 17. Assumptions, risks & open questions
## 17.1 Open questions (need product/business decisions)
Membership sub-levels: define "Crux II / Crux 5 / Crux 6" status referenced in ranking conditions.
Bronze & Silver monthly earnings (currently TBD).
Payment provider(s): Paystack / Flutterwave / Stripe? Determines deposit/withdrawal/checkout integration.
Video/audio provider for care calls & Point Facility: Agora, Twilio, Daily, or LiveKit?
SMS/WhatsApp OTP provider (e.g., Twilio, Termii, WhatsApp Business API).
Currency: single display currency vs. multi-currency; base currency and FX handling.
Whether the app can create new Basic Network memberships or link-only (v1 assumes link-only).
KYC requirements and jurisdictions for commitment (regulated-product review).
Point Facility recording retention & consent policy.
## 17.2 Key risks
Regulatory—Fixed-return Commitment and cooperative lending may be regulated and require legal sign-off before launch.
Financial integrity—Money math must stay server-authoritative and idempotent; mobile network flakiness is a double-charge risk if mishandled.
Health data sensitivity—Case files/health info demand strict access control and encryption; breach impact is high.
Scope breadth—Eight epics—phasing (§16) is essential to avoid a stalled mega-release.
## 17.3 Assumptions
Existing web platforms expose (or can quickly expose) the domain services the API needs.
The existing MySQL schema is the source of truth; mobile adds only the tables in §13.3.
Ranking, interest, and cooperative rules are fixed as stated and only surfaced by mobile.
End of PRD. See the companion "CruxCare Mobile—Design Scope & UX Specification" for screen-level design, tokens, and Claude Designs handoff.