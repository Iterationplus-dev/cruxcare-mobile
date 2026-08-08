# Screen inventory

125 screens across eight files. Each row is one drawn screen: its code, what the user does there, and the design note attached to it in the prototype. Codes are stable — use them in tickets, branch names and commit messages.


## Auth and Account

`CruxCare Auth and Account.dc.html`

### 1 · CLIENT AUTHENTICATION

| Code | Screen | Design note |
| --- | --- | --- |
| CA1 | Welcome / Get started | Three-slide carousel · both auth doors and the guest path on every slide |
| CA2 | Create account | Six fields · strength meter · confirm password with live match · consent explicit, never pre-checked in code |
| CA3 | Verify OTP | Partial entry · CTA stays disabled until six digits · cooldown visible |
| CA3-e | OTP wrong code | Error state · attempts remaining and the lockout consequence stated up front |
| CA4 | Log in | Biometric option · recovery and the therapist door both reachable |
| CA4-e | Log in failed | Generic message by design · attempts left · escalation to human recovery |
| CA5 | Biometric opt-in | Post-login · password stays the fallback · step-up still applies to money actions |

### 2 · THERAPIST AUTHENTICATION

| Code | Screen | Design note |
| --- | --- | --- |
| TA1 | Become a therapist (landing) | Requirements and review time before any form · role-add path stated |
| TA2 | Verify Crux ID | Same Crux ID details as A5 · register match shown before the OTP |
| TA3 | Professional verification | Incomplete state · CTA disabled with the reason named beneath it |
| TA3-r | Verification under review | Waiting state · progress checklist · work that can continue meanwhile |
| TA4 | Add or update location | Also the edit screen later · privacy default hides the street until payment |
| TA5 | Choose a therapist plan | Same plans and limits as A6 · purchases unlimited on every tier |
| TA6 | Therapist onboarding complete | Success · three concrete next actions instead of a dead end |

### 3 · ACCOUNT RECOVERY

| Code | Screen | Design note |
| --- | --- | --- |
| AR1 | Forgot password | Channel choice · consequences of a reset stated before it happens |
| AR2 | Verify recovery OTP | Complete entry · anti-phishing line sits with the code, where it is read |
| AR3 | Reset password | Live requirement checklist · device sign-out offered in the same step |
| AR4 | Password reset success | Receipt, not a cheer · fraud report reachable in one tap |
| AR5 | Account recovery (assisted) | Identity evidence · balances frozen during review, said plainly |

### 4 · ACCOUNT MANAGEMENT

| Code | Screen | Design note |
| --- | --- | --- |
| AM1 | Delete account | Obligations first, reason second · softer alternatives offered |
| AM2 | Delete confirmation | Typed word plus password · the grace-period date named, not described |
| AM3 | Account deleted | Settlement receipt · the undo path is a real button, not fine print |
| AM4 | Log out confirmation | Sheet · unsynced work named before the destructive tap |

### 5 · PROFILE

| Code | Screen | Design note |
| --- | --- | --- |
| PR1 | View profile | Roles as badges · role-add entry point · tab bar keeps Profile selected |
| PR2 | Edit profile | Cosmetic fields only · verified fields deliberately live elsewhere |
| PR3 | Personal information | Verified state per field · data export sits with the data it exports |
| PR4 | Security and privacy | Each toggle states what the off state means · device count flags risk |
| PR5 | Notification settings | Required versus optional split honestly · quiet-hours exception stated |
| PR6 | Payment methods | Expired-card state inline · provider left open, as the PRD leaves it |

## Client Dashboard

`CruxCare Client Dashboard.dc.html`

### 6 · CLIENT DASHBOARD

| Code | Screen | Design note |
| --- | --- | --- |
| CD1 | Home | Next session first · plan progress · reorder from real purchase history |
| CD2 | Discover therapists | Slots on the card · fully-booked therapists stay visible with a waiting list |
| CD3 | Book appointment | Taken slots shown struck through · wallet split and cancellation cut-off stated |
| CD4 | Sessions | Three states in one list · pending booking says what happens if nobody acts |
| CD5 | Messages | Scope disclaimer pinned · attachments · quick replies · read receipt |
| CD6 | Progress tracking | Self-rated data labelled as such · therapist note gives the numbers meaning |
| CD7 | Resources | Therapist-shared material ranks above editorial · medical disclaimer at the foot |
| CD8 | Settings | Destructive actions isolated in their own card at the bottom |

## Therapist Dashboard

`CruxCare Therapist Dashboard.dc.html`

### 7 · THERAPIST DASHBOARD

| Code | Screen | Design note |
| --- | --- | --- |
| TD1 | Dashboard (Today) | Expiring requests at the top · next session highlighted in the list |
| TD2 | Appointment management | Request reason visible before accepting · consequence of declining stated |
| TD3 | Availability and schedule | Weekly template plus rules · pause explained without hiding the listing |
| TD4 | Client management | List plus record in one view · unwritten notes flagged on the client |
| TD5 | Session notes | Draft state · product recommendation links to the shop · lock rule stated |
| TD6 | Earnings and payouts | Available versus clearing split · statement reconciles to the paid figure |
| TD7 | Analytics | Capacity beside volume · one actionable observation, not a wall of charts |
| TD8 | Therapist settings | Role switch and practice pause here · account deletion stays in client settings |

## Phase 1 Screens

`CruxCare Phase 1 Screens.dc.html`

### A · ONBOARDING

| Code | Screen | Design note |
| --- | --- | --- |
| A1a | Welcome · slide 1 | Brand promise · full-bleed art fading into the teal |
| A1b | Welcome · slide 2 | Marketplace promise · same layout, art swapped |
| A1c | Welcome · slide 3 | Routing slide · guest path preserved |
| A2 | Register (client) | Sticky CTA · country picker · match confirmed inline |
| A3 | OTP verify · serves both lanes | Client signup, and step 2 of 3 for the therapist lane · 3 attempts · resend cooldown |
| A4 | Health profile gate (client) | Care is gated, commerce isn't · names what's locked and why |
| A5 | Become a therapist · link Crux ID | Entered from the member profile · WhatsApp, SMS or email · no second account |
| A6 | Therapist plan | After the Crux ID is verified · limits honest up front |
| A7 | Biometric opt-in | Post-login · explains step-up still applies |
| A8 | Add a role (existing member) | No second signup · client added instantly, therapist needs verify + plan, admin is granted |

### B · HOME DASHBOARDS

| Code | Screen | Design note |
| --- | --- | --- |
| B1 | Client home | Next visit first · four quick actions · upsell is soft |
| B2 | Member home | Rank snapshot · money at work · referral nudge |
| B3 | Therapist home | Agenda first · requests surfaced · plan usage visible |
| B4 | Admin home | Queue counts → decisions inline · figures from server |

### C · MARKETPLACE

| Code | Screen | Design note |
| --- | --- | --- |
| C1 | Catalog | Search + chips · 2-up grid · stock stated honestly |
| C2 | Product detail | Sticky CTA with live total · collapsible detail |
| C3 | Cart | Line items · server re-check disclosed · on-behalf hint |
| C4 | Checkout ⧉ summary sheet | Server-priced totals · resulting balance shown before paying |
| C5 | Order confirmed | Reference + receipt + next step · restrained celebration |
| C6 | Order detail & timeline | Status timeline · receipt · reorder |

### D · CLIENT CARE

| Code | Screen | Design note |
| --- | --- | --- |
| D1 | Care hub | Therapist first · profile gaps flagged · recommendations flow to shop |
| D2 | Appointment booking | Day strip → slots → type · plan usage stated on the CTA |
| D3 | Health profile | Consent up top · sectioned form · gaps named, not scolded |
| D4 | Chat thread | Presence · receipts · attachments · typing indicator |
| D5 | Video visit | Recording consent persistent · 56px controls · dark surface |
| D6 | Case file (therapist) | Notes → recommendation → order on behalf · profile gaps flagged |

## Phase 2 Finance

`CruxCare Phase 2 Finance.dc.html`

### E · WALLET

| Code | Screen | Design note |
| --- | --- | --- |
| E1 | Wallet home | One balance, three commitments of it · pending states up front |
| E2 | Ledger | Grouped by day · fees named on the row · month summary |
| E3 | Withdraw amount | Bounds stated · fee promised, not yet claimed · "Review", not "Send" |
| E4 | Fee preview ⧉ | Server figures, quote expiry, resulting balance, step-up warned |
| E5 | Submitted, not "done" | Amber not green · settlement is the server's word, not ours |

### F · COMMITMENT

| Code | Screen | Design note |
| --- | --- | --- |
| F1 | Commitment overview | Lock time visible everywhere · interest separated from principal |
| F2 | New commitment | Terms are the form, not the fine print · explicit consent to the lock |
| F3 | Cycle detail | Lock as a ring · every credit traceable to a wallet entry |
| F4 | Withdraw interest ⧉ | Says plainly what does  |
| F5 | 60-day notice | Countdown, approval step and a reversible path all visible |

### G · COOPERATIVE

| Code | Screen | Design note |
| --- | --- | --- |
| G1 | Cooperative account | Consistency is the metric · eligibility stated as fact, not a badge |
| G2 | Request help | Eligibility as a checklist · repayment shown before requesting |
| G3 | Nominate guarantors | Their eligibility shown too · CTA states exactly what's missing |
| G4 | Repayment status | Outstanding first · guarantors named, since they carry the risk |
| G5 | Member transfer ⧉ | Both sides of the fee shown: what they get, what you lose |

### H · RANK & NETWORK

| Code | Screen | Design note |
| --- | --- | --- |
| H1 | Rank overview | Real thresholds (115 → 305) · the extra Crux II condition surfaced |
| H2 | Full progression | Seven tiers plus Life Director · unknowns labelled TBD, not invented |
| H3 | Invite & downline | Crux ID is the link · downline shows which platform each join counts for |

## Phase 3 Growth

`CruxCare Phase 3 Growth.dc.html`

### J · NETWORK & EARNINGS

| Code | Screen | Design note |
| --- | --- | --- |
| J1 | Downline tree | Expand in place · platform tags · no double counting |
| J2 | Downline member | What you may see is stated · routes into the guarantor flow |
| J3 | Earnings history | Open month marked "in progress" · nothing projected forward |
| J4 | Monthly statement | Every credit traceable to a reference and a wallet entry |
| Gold | District Coordinator | 12 May 2026 · passed 115 referrals |
| J5 | Achievement timeline | Dated facts, not badges · the next tier sits open at the end |

### K · NOTIFICATIONS & ACCOUNT

| Code | Screen | Design note |
| --- | --- | --- |
| K1 | Notification inbox | Actionable items lifted to the top with the action named |
| K2 | Preferences | Per category per channel · security row locked, and says why |
| K3 | Profile | Roles are a list you can act on · unavailable roles say what's needed |
| K4 | Role switch ⧉ | Says what changes and what doesn't · unavailable role offers the path |

## Phase 4 Engagement

`CruxCare Phase 4 Engagement.dc.html`

### L · POINT FACILITY

| Code | Screen | Design note |
| --- | --- | --- |
| L5 | Host tools | Eligibility and capacity stated · drafts separate from published |

### M · ADMINISTRATION

| Code | Screen | Design note |
| --- | --- | --- |
| M1 | Approvals queue | Eligibility as chips · age surfaced · audit note stated |
| M2 | Financial review ⧉ | Checks passed listed · irreversibility named before the button |
| M3 | Client assignment | Plan limits enforced visibly · blocked option explains itself |
| M4 | Monitoring | Scheduled jobs by last run · read-only, and says so |

### N · STATE PASS

| Code | Screen | Design note |
| --- | --- | --- |
| N1 | Loading | Skeleton mirrors the real layout · one live-region message |
| N2 | Empty | Real $0.00 still shown · two ways out, not a dead end |
| N3 | Offline | Cached values greyed and stamped · writes disabled, never queued |
| N4 | Error (money action) | States what didn't happen · keeps the input · reference to quote |

### O · PUSH NOTIFICATIONS, END TO END

| Code | Screen | Design note |
| --- | --- | --- |
| O1 | Priming | Asked after the booking, not at launch · names what arrives |
| O2 | System permission | Native dialog, unstyled by us · fired only after a Yes on O1 |
| O3 | Delivered · lock screen | Grouped by app · time-sensitive pierces quiet hours, marketing doesn't |
| O4 | Delivered · in-app | Foreground presentation · actions inline · never blocks the CTA |
| O5 | Opened · deep link | Lands on the record, not the inbox · figures re-fetched, never from the payload |
| SMS | security codes and money | ••• 8821 |
| Email | receipts and orders | a•••u@mail.com |
| O6 | Denied · recovery | Concrete cost, not nagging · names the fallbacks that still work |
| O7 | Admin composer | Reach shown honestly · muted members stay muted · four-eyes over 1,000 |
| O8 | Delivery report | Auditable · mutes counted as a result, not a failure |

## Shared Features

`CruxCare Shared Features.dc.html`

### 8 · SHARED FEATURES

| Code | Screen | Design note |
| --- | --- | --- |
| SH1 | Notifications | Unread tinted and dotted · grouped by day · settings escape at the foot |
| SH2 | Chat and messaging (inbox) | Support thread sits with therapist threads · closed chat state · safety notice |
| SH3 | Search | One field across therapists, products and help · matches highlighted |
| SH4 | Help and support | Open case surfaced first · self-serve above the human channel |
| SH5 | FAQ | One answer expanded to show the pattern · usefulness vote · escape hatch |
| SH6 | Terms and privacy | Plain-language summary above the clauses · version and date always shown |
| SH7 | Contact support | Transaction attached from context · says exactly what data travels with it |

---

Total: 125 screens.
