# Treatment Lifecycle — Backend Note

**Audience:** Senior Laravel engineer
**From:** Mobile (Ionic/Vue/Capacitor)
**Date:** 15 September 2026
**Companion to:** [`FRONTEND_API_HANDOFF.md`](FRONTEND_API_HANDOFF.md) §4.3 (client care and therapist-facing data)

> **Answered 15 September 2026 (backend).** All four questions in §7 are decided; §1–§4 are built
> on `upgrade/laravel-12`. The decisions are recorded inline below, marked **Answered**. The one
> with teeth is §2: the choice is **(b)**, so extra visits are a top-up plan the client buys and
> **the extension does not apply until it settles**. That made the sentence this note quotes in §2
> false, and it has been corrected in the app along with the flow behind it.
>
> The backend also added one route this note did not ask for —
> `DELETE /cases/{id}/extensions/{id}` — because (b) creates a dead end without it. Client is wired.

---

## 0. What this note is

A round of product changes landed in the mobile client covering the care plan, the
recommendation list, the case bill and the therapist's record of treatment. Most of them work
against the API as it stands. Five do not, and this note is the list of those five, with the
shape the client already codes against, so you can accept or amend it before anything is built.

Everything below is **implemented in the mobile mock** (`src/mocks/handlers.ts`), so the screens
are real and can be demoed today with `VITE_USE_API_MOCKS=true`. The mock is the client's
reading of the contract, not a specification you are bound to — where you disagree, say so and
the client changes.

Two conventions hold throughout, both already in force elsewhere in the API:

- **Money and eligibility are computed server-side.** The app names a *piece* and never a price.
  This is why §3 asks for a figure rather than adding two of yours together.
- **Unknown enum values degrade rather than break.** New `trend` or status values can ship
  server-first.

---

## 1. `POST /cases/{caseId}/progress` — the recovery record

**Status:** new endpoint. Client is wired; no server route exists.

Once treatment starts, the therapist needs somewhere to record how the client is actually
responding — distinct from `CaseFileNote`, which is the clinician writing to themselves and can
sit in `draft`. A progress report is the thing an extension or a closing summary is argued from,
so it has no draft state: it is written or it does not exist.

### Request

```json
{
  "condition": "Rotation pain down from 7 to 4; range of motion visibly better.",
  "productsAdministered": "Care Blood Activator, one sachet applied topically.",
  "techniques": "Deep tissue work on the trapezius, 20 minutes; assisted stretching.",
  "trend": "improving",
  "recordedFor": "2026-09-12"
}
```

| Field | Rules |
| --- | --- |
| `condition` | **Required.** Non-blank. `422 condition_required` otherwise. |
| `productsAdministered` | Optional, nullable. The client sends `null`, never an empty string. |
| `techniques` | Optional, nullable. Same. |
| `trend` | `improving`, `unchanged` or `worsening`. Open-ended — an unrecognised value renders as itself. |
| `recordedFor` | `YYYY-MM-DD`. **The day being reported on, not the day it was typed up** — a therapist writing up Friday's session on Monday is reporting about Friday. Do not derive it from `created_at`. |

### Response — `201`

```json
{
  "data": {
    "id": "progress-9",
    "authorId": "therapist-1",
    "condition": "Rotation pain down from 7 to 4.",
    "productsAdministered": null,
    "techniques": null,
    "trend": "improving",
    "recordedFor": "2026-09-12",
    "createdAt": "2026-09-15T10:04:00Z"
  }
}
```

### Refusals

| Code | Status | When |
| --- | --- | --- |
| `treatment_not_started` | 409 | `treatmentStartedAt` is null. There is nothing to report on, and an entry dated before the first session makes the record say something untrue. |
| `condition_required` | 422 | `condition` missing or blank. |

### Carried on the case file

`GET /case-files/{id}` gains `progressReports: CaseProgressReport[]`, **newest first**. Absent is
read as "none written", never as an error, so this can ship after the POST route.

**Please confirm:** should a progress report be visible to the *client*? The mobile client
currently does not show it to them, on the assumption that it is clinical record like the
diagnosis and the draft notes — but that is our assumption, not your rule. If any of it is
client-safe, it needs a narrow client route the way `GET /cases/{id}/recommendations` is narrower
than the case file.

---

## 2. `POST /cases/{caseId}/extend` — a longer treatment window

**Status:** new endpoint. Client is wired; no server route exists.

When the scheduled course finishes and the client is not well, the therapist extends rather than
closing the case and opening another — closing loses the history, which is the thing that makes
the second course make sense.

### Request

```json
{
  "endDate": "2026-11-01",
  "addedVisits": 4,
  "reason": "Recovery on track but slower than planned."
}
```

| Field | Rules |
| --- | --- |
| `endDate` | Must be **strictly after** the current `treatmentPlan.endDate`. Shortening a window is a different operation with different money consequences; this is not it. |
| `addedVisits` | Integer, zero or more. **Zero is a real value**, meaning "more time on the visits they already bought". |
| `reason` | **Required**, non-blank — same purpose as the closing summary. An extension nobody justified is a record nobody can use. |

### Refusals

| Code | Status | When |
| --- | --- | --- |
| `no_treatment_window` | 409 | No `treatmentPlan.endDate` to extend. |
| `end_date_not_later` | 422 | `endDate` is not after the current end date. |
| `reason_required` | 422 | Blank reason. |

### What it must do

1. Move `treatmentPlan.endDate` (and `treatmentEndDate`) to the new date.
2. **Keep what it replaced.** Append to `treatmentExtensions`, oldest first:
   `{ id, previousEndDate, newEndDate, addedVisits, reason, extendedAt, extendedBy }`.
   Overwriting the end date erases "this course ran twice as long as planned", which is
   clinically meaningful.
3. Move `subscription.endsAt` to match, and where `addedVisits` is above zero, raise
   `visitsTotal` and `visitsRemaining` by that number.

### The question this note cannot answer

**Extra visits are sessions nobody has paid for.** More *time* costs the client nothing — the
window is the therapist's to set. More *visits* is a purchase. The mock currently grants them
free, which is certainly wrong for production. Three options, and this is your call because it is
a commercial rule, not a UI one:

- **(a)** Added visits are billed at the plan's per-visit rate and appear on the case bill as a
  new treatment component. `CasePaymentStep` would gain a fourth key.
- **(b)** Extending with added visits requires a new plan choice and pays through the existing
  rail.
- **(c)** Added visits are free at the therapist's discretion, capped server-side.

Whichever you pick, the client needs to know **before it renders the sheet**, because the copy
differs. Today it says *"Extra visits are sessions they have not bought, so those are added to
their bill"*, which is a promise about (a). If the answer is (c), that sentence is a lie and has
to change with the same release.

> **Answered — (b).** Extra visits are offered as a top-up plan priced at the current plan's
> per-visit rate, bought on the existing `care-plan` rail. **The extension does not apply until it
> settles:** the end date does not move and `visitsTotal` does not change, and the extension sits
> `awaiting-payment` until then. Added visits join the subscription already running rather than
> opening a second one, so `visitsUsed` keeps counting real sessions.
>
> `TreatmentExtension` therefore carries five more fields — `status`, `planId`, `amountMinor`,
> `currency`, `appliedAt` — without which the app cannot tell an extension that happened from one
> still waiting to be paid for.
>
> Three further refusals: `extension_awaiting_payment` (409, one is already pending),
> `no_treatment_plan` (409, no per-visit rate to price from) and `plan_not_paid` (409, no ledger to
> top up). A pending offer is **not** counted in `outstandingMinor` and does not block closing.
>
> **`DELETE /cases/{id}/extensions/{id}`** was added on top of this note's ask, because
> `extension_awaiting_payment` would otherwise let a client who simply never pays block every
> future extension. The row survives as `withdrawn` rather than being deleted.
>
> On the bill, extensions are a **third component** beside treatment and products — folding them
> into treatment would re-price a deposit already paid, since the 70/30 schedule is a percentage of
> the treatment component.
>
> **Client status:** done. The sheet's copy is corrected, it offers rather than asserts when visits
> are added, pending offers render as such with a withdraw control, and the bill carries the third
> row.

---

## 3. `dueNowWithProductsMinor` and `item: "due-plus-products"`

**Status:** amendment to two existing endpoints.

A client on instalments owes two different figures, and the app could previously only offer one
of them. The plan is spread over the course; the goods are not. So "pay what I owe today" meant
two separate trips through the Monnify sheet for one decision.

### 3a. `GET /cases/{caseId}/bill`

Add one field to the `payment` object:

```json
"payment": {
  "instalmentsAvailable": true,
  "dueNowWithProductsMinor": 16500
}
```

It is the **outstanding amount of the instalment whose status is `due` or `overdue`**, plus
`productsOutstandingMinor`. On a splittable plan that is the deposit until it is settled and the
balance afterwards — the same order your `schedule` already renders.

This has to come from you. The app must not add the two together itself: doing so means deciding
*which step is due*, and a device that decides the balance is due before the deposit has just
paid a plan in the wrong order. It is the same reasoning that keeps the 70/30 split server-side.

Optional field. Absent, the app offers no such button rather than one it priced itself.

### 3b. `POST /payments/intents`

Accept a new `item` value on `purpose: "case-balance"`:

```
item: "treatment-deposit" | "treatment-balance" | "treatment" | "products"
     | "due-plus-products"        <-- new
     | "everything"
```

Priced exactly as `dueNowWithProductsMinor`. On settlement it credits **both** components — the
treatment share against the instalment that was due, the remainder against products.

`everything` keeps its meaning and its own button: it settles the future instalment too, and that
is a different choice the client is entitled to make.

---

## 4. `chosen` on the care plan catalogue

**Status:** one boolean on an existing endpoint.

`GET /care/plans?caseId=...` returns the cadence options, and nothing in the payload says which
one the client already picked. The bill proves *that* a plan was chosen (a non-zero
`treatmentTotalMinor`) but never *which*, so the screen could only keep re-offering the whole list
underneath the client's own bill — inviting them to make a decision they had already made, and
reading as though it had not registered.

```json
{ "id": "plan-twice-weekly", "title": "2 visits a week", "chosen": true }
```

True on at most one option, resolved from the case's subscription. Optional: without it the app
falls back to an unnamed "Your plan is set" summary, which is honest but poorer.

Related, and **already correct on your side** — no change wanted, recorded so it is not "fixed"
later: `POST /cases/{id}/plan/choose` refusing with `409 treatment_part_paid` once a deposit is
down is right. A deposit was 70% of a particular price. The app now stops offering the change
rather than letting the client discover the refusal by tapping.

---

## 5. Laboratory test results — text today, attachments wanted

**Status:** works as-is; a request for later.

The client health profile gained two sections, `labResults` and `additional`. Both ride the
existing `PUT /health-profile` `sections[]` array as free text, so **nothing is needed from you to
ship them**.

But a lab result is a document. Clients photograph them, and typing the numbers out is both a
transcription risk and a barrier. The API client already serialises `multipart/form-data` through
the native bridge (`src/api/client.ts`), so the device side is ready. What is missing is somewhere
to send it:

```
POST   /health-profile/attachments                      multipart: file, label
GET    /health-profile/attachments
DELETE /health-profile/attachments/{id}
GET    /clients/{clientId}/health-profile/attachments   therapist, gated by the §15 grant
```

The consent gate is the reason this is not simply "add file upload": attachments must sit behind
**the same `health-profile/access` grant** as the profile sections. A therapist with no grant must
not be able to read, list, or discover the existence of a client's lab report. Not urgent — please
just confirm the shape before either side builds it.

---

## 6. Confirmed working — no change wanted

Recorded so a future refactor does not quietly undo them.

| Behaviour | Why it matters |
| --- | --- |
| Removal of a **paid** recommendation is refused with `409 recommendation_already_paid` | Correct. Removing a paid line is a refund, not a delete. The app disables the control from `removable` rather than offering it and being refused. |
| `removable` and `paidMinor` are **per line** | Needed for the above: a case-wide products total cannot answer "may *this* line be removed?". Both are still optional in our types because they were absent from the live payload on 14 September — please make them unconditional. |
| Recommendations can be added at **any** open stage | A therapist adding a product mid-treatment is normal practice, not an edge case. Nothing gates `PATCH /case-files/{id}` with a `recommendation` body on stage today. Please keep it that way. |
| Accepting is **per line**, and there is no decline | The "Add all to my plan" control the client gained is N accept calls, not a new bulk endpoint. A bulk route would be welcome but is not needed. If you add one it must be all-or-nothing, because the app currently reports honestly on a partial failure and would have to stop doing so. |

---

## 7. What we would like back

1. **§2** — which of (a), (b) or (c) for paying for extra visits. This blocks the copy, not just
   the code.
2. **§1** — is any part of a progress report client-visible?
3. **§3** — accepted, or would you rather the app called two intents?
4. **§5** — attachment shape, when you get to it.

Nothing here blocks a mobile release. Every screen works against the mock, and the four
client-side items (§3, §4, §5, §6) degrade to their previous behaviour when the fields are absent.
**§1 and §2 are the exception:** they are inert without server routes, so the therapist's "Add
report" and "Extend treatment" controls will call endpoints that 404 until they exist.
