# Design: Funnel event-model redesign (Meta Pixel + CAPI) + draft-leads decoupling

**Date:** 2026-07-26 · **Status:** approved by Oliver (brainstorm session, same day)
**Supersedes:** the Schedule slice of `docs/plans/meta-capi-phase2-handoff.md` (banner applied)
**Read first:** `docs/plans/2026-07-26-funnel-event-model-research-findings.md`
(three-agent research + ratified requirements R0–R4; decisions there are CLOSED)
**Origin:** `docs/plans/2026-07-26-funnel-event-model-redesign-handoff.md`

## Mission

Ship the ratified Meta event ladder before the Showcase campaign activates, and
start the lead/customer decoupling in its lowest-risk corner (draft leads),
with the full decoupling + customer-demotion migration designed here and
executed as a post-launch epic (Track 2).

## Decisions log (ratified — do not re-litigate)

1. `Lead` stays at PII submit, renter-gated, dual-fire — THE optimization
   event (volume math: ~35/wk vs Meta's ~50/adset/wk learning bar).
2. NO Lead↔CompleteRegistration swap; per-event "weight" does not exist
   (AEM prioritization removed ~2025).
3. NO `Purchase`-as-appointment. `Purchase` reserved for contract-signed with
   real `value`/`currency` (future phase-2 tail).
4. CRM appointment-set = standard **`Schedule`**, server-only CAPI. Appointment
   set ≡ **meeting created** (NOT pipelineStage).
5. **Standard Meta events only — no custom events** (`ZipQualified`,
   `FunnelEngaged` dropped). ZIP-stage analytics are first-party. Revisit
   trigger: wanting an in-Ads-Manager cost column for a mid-funnel stage.
6. Renter gate rule: **renters fire traffic events, never conversion events.**
   Gated: `Lead`, `CompleteRegistration`, `Schedule`. Ungated: `PageView`,
   `ViewContent`. Renters still ingest to CRM and still get draft-lead rows.
7. Lead/customer decoupling approach **B — two tracks**: draft-leads table now
   (Track 1, pre-launch); full port + customer demotion post-launch (Track 2).
   End-state: `leads` owns the lead phase; **`customers.leadId` FK** references
   it; leads never reference customers.
8. **Platform-scoped naming**: Meta is not assumed to be the only ad platform
   (Google Ads may follow). Anything provider-specific carries the provider in
   its name (`metaLeadEventId`, `metaScheduleSentAt`, `fbclid`, `fbp`;
   `gclid` is already captured). Generic names are reserved for
   provider-agnostic concepts (`utmJSON`, `stepTimelineJSON`).
9. UL additions: `Schedule` (= CRM appointment-set) and the `Purchase`
   reservation. No custom-event vocabulary.

## Section 1 — Final event model

| Stage | Event | Fire | Renter gate |
|---|---|---|---|
| Funnel page load | `PageView` | Browser (pixel loader, as-is) | No |
| First answer on any step | `ViewContent` | Browser (convention emitter, as-is) | No |
| ZIP accepted | — no Meta event — first-party only | | |
| PII form submit | `Lead` | Dual-fire, shared event_id (as-is) | Yes (as-is) |
| Confirmation reached | `CompleteRegistration` | Browser-only (as-is) | **Yes (new)** — gate in `use-funnel-tracking.ts` via `engine.answers` + `firesLeadOptimization` |
| Meeting created in CRM | `Schedule` | **Server-only CAPI (new)** | **Yes (new)** |
| Contract signed | `Purchase` + value/currency | Future — out of scope | — |

Convention-over-wiring preserved: events bind to step kinds
(`convention-map.ts`), zero per-funnel wiring. The dormant browser-`Schedule`
`trackFunnelEvent` seam in `funnels.router.ts` is **retired** — the name now
belongs to the CRM event. If an in-funnel datetime step ever ships, it gets a
different (then-to-be-named) event; a requested slot is not a set appointment.

## Section 2 — CRM `Schedule` slice

**Trigger:** meetings entity **creation hook** → QStash job (`meta-capi-event`
variant) → `meta-sync.service` → CAPI. Follows the existing provider tiers
(ADR-0003); no raw db access outside DAL; entity-owns-its-mutations.

**Guards at the hook:**
1. Customer originated from a funnel lead with Meta identity (fbclid/fbp/lead
   metadata present). Telemarketing-origin meetings never fire — no web
   journey to attribute.
2. Renter gate: `firesLeadOptimization` over the stored funnel answers.

**Once-per-lead semantics:** appointment-set is a lead-level milestone.
Rescheduled/re-created meetings must not re-fire.
- `event_id = appt-set-<customerId>` (lead-identity-keyed, not
  meeting-keyed). Track-1 note: the funnel lead's identity row IS the
  customer today, and the slice must also cover pre-existing funnel
  customers who have no `leads` row until Track 2's backfill — so the slice
  reads funnel/lead metadata and match keys **from the customer row**, and
  the once-ever marker `metaScheduleSentAt` is a second additive column on
  **customers** (tightening tally: both move to `leads` in Track 2).
- Meta's dedup window is only 48h, so idempotence is ours to enforce via the
  marker.
- QStash retry horizon < 48h. No backfill of events older than 7 days, ever
  (CAPI rejects the whole batch).

**Payload (per research §2):** `action_source: 'website'`, `event_source_url`
= originating funnel URL (must pass the dataset domain allow-list),
`event_time` = meeting-creation moment (never backdated), user_data = full
persisted match-key bundle (hashed em/ph/fn/ln/ct/st/zp/country +
external_id(leadId) + fbp + fbc (send even if stale; reconstruct from fbclid
when absent, existing `derive-fbc`) + submit-time IP/UA). Target EMQ ≥ 7.
Non-prod carries `test_event_code` exactly as today.

## Section 3 — Draft leads table (Track 1, decoupling increment 1)

New `leads` table; nothing existing depends on it at launch.

```
leads
├─ id (pk)
├─ funnelSlug, trade
├─ answersJSON (jsonb)                    — answers-so-far, keyed by step id
├─ stepTimelineJSON (jsonb, append-only)  — [{ stepId, stepIndex, enteredAt }]
├─ fbclid, fbp (nullable)                 — Meta attribution
├─ utmJSON (jsonb)                        — provider-plural (incl. gclid via useFunnelUtm)
├─ metaLeadEventId (nullable)             — Meta Lead event_id, set at PII submit
├─ createdAt / updatedAt
```

(`metaScheduleSentAt` lives on **customers** in Track 1 — see §2 — and
migrates here in Track 2.)

- **Created on first answer** (not page load — filters bots/bounces) via a new
  rate-limited fire-and-forget tRPC procedure; draft id held client-side for
  the session. Step advances append to `stepTimelineJSON` and upsert
  `answersJSON` via the DAL — full-value writes, never shallow JSONB merges
  (`jsonb-columns.md`).
- **No PII on drafts.** PII enters only through `submitLead`.
- At PII submit, the same transaction stamps `metaLeadEventId` and sets
  **`customers.leadId`** (new nullable FK column — the single additive change
  to customers; already points in the end-state direction).
- **Status is derived, never stored**: no referencing customer = draft.
- **Retention:** unconverted drafts pruned after 90 days (scheduled job).
  Converted leads permanent.
- **Indexes:** `(funnelSlug, createdAt)`; `fbclid`.
- Renters get draft rows (first-party analytics wants everyone).

**Queries this table exists to answer:** per-step drop-off per funnel; step
dwell time (`enteredAt` deltas); ZIP-qualified rate + first-party
cost-per-ZIP (spend ÷ qualified drafts, per ad via UTM ad-id, fbclid
fallback); renter share per ad/creative.

## Section 4 — Meta-side ops & analytics

All events standard → **zero custom conversions needed**. Launch-day ops:

1. Build + save Ads Manager column preset **"Funnel Ladder"**: Spend → CPM →
   Link CTR → Cost/Landing Page View → ViewContents (+cost) → Leads +
   Cost/Lead → CompleteRegistrations → Schedules + Cost/Schedule. Read at ad
   level, left-to-right; each adjacent ratio names a suspect (creative →
   landing → funnel → PII form → sales-ops).
2. Real-browser Events Manager validation (Section 5).

**KPI ledger — one home per metric:**

| Metric | Home | How | Cadence |
|---|---|---|---|
| Cost/LPV, CPL, cost/Schedule | Meta native columns | Funnel Ladder preset | Weekly |
| Per-step drop-off, dwell, ZIP-qual rate | First-party (leads) | §3 queries | Weekly |
| True cost/appointment incl. >7d tail | First-party ÷ Meta spend | CRM meetings by lead cohort ÷ spend per ad (UTM) | Monthly |
| Meta-vs-CRM appointment delta | Both | Meta Schedules − CRM meetings per cohort — "how much reality Meta sees" | Monthly |
| EMQ ≥7 (Lead, Schedule), dedup health, diagnostics | Events Manager | Manual | Weekly |

Pre-launch: write down target ranges per rung (thresholds, not vibes).

**Campaign-duplication runbook** (→ `scripts/meta/DOCS.md`): declare
`contentCategory` → ladder self-wires → campaign spec `optimizationEvent:
'LEAD'` + `pnpm meta sync` → apply saved preset → one Events Manager
validation pass → baseline rung thresholds after ~2 weeks.

**Doc updates in the implementation PR:** `providers/meta/DOCS.md` (Schedule
invariant: documented server-only exception to dual-fire + once-per-lead
idempotence), `scripts/meta/DOCS.md` (ladder + runbook),
`docs/ubiquitous-language.md` (§Decisions 9).

## Section 5 — Verification & rollout

No test runner in repo. Verification:
- `pnpm lint && pnpm tsc` preflight (never build).
- Real-browser loop (NEVER headless): Events Manager Test Events "Open
  Website" + Pixel Helper — `Lead` shows Browser+Server merged (one
  event_id), `Schedule` arrives via `test_event_code` from a dev meeting
  creation, EMQ ≥7, diagnostics clean.
- Isolation invariants untouched: browser host gate, CAPI `test_event_code`,
  prod boot hard-fail if code set.

**Rollout order:** implement all Track-1 work → deploy → same-day Funnel
Ladder preset + validation → activate Showcase optimizing on `Lead`
(7-day-click/1-day-view) → hands off ad sets ≥7 days. Never add events
mid-campaign (invisible signal drift). Optional at ~4 weeks: one probe ad set
optimized on `Schedule`; expect learning-limited; kill if it loses.

## Section 6 — Customers→leads backfill migration (Track 2, post-launch epic)

Once `leads` carries the full lead-phase field set, existing customers with
**zero real-world entanglements** are converted to leads — they were only
customers because no leads table existed. Requirements + safety protocol
here; execution gets its own writing-plans plan when Track 2 runs.

**Predicate — surgical, not "no meetings":** demotable ⟺ no meetings AND no
projects AND no proposals AND no contracts AND no other blocking references.
First deliverable: a **complete FK-reference census of `customers`**
(schema-wide), each reference classified *demotion-safe* (moves with the
lead: pipeline stage, funnel metadata, call/dispatch history — verify each)
vs *demotion-blocking* (real-world evidence). **Census reviewed by Oliver
before any write.**

**Mechanics — convert by porting, not mutating:**
- **Phase A (all customers):** create a `leads` row from each customer's
  lead-phase fields; set `customers.leadId`. Non-destructive.
- **Phase B (demotable only):** lead row becomes the surviving record;
  demotion-safe references re-pointed; customer row **archived** (archive
  table or soft-delete) with a `customerId → leadId` mapping log. Never
  hard-delete in this phase.
- **Phase C:** hard-delete archives only after a verification window with
  queries/UI running clean on the new shape.

**Safety protocol (non-negotiable):**
- Script under `scripts/`, `import './lib/load-env'`; dev-first against a
  fresh prod snapshot (`pnpm db:snapshot`); prod only via explicit
  `DRIZZLE_TARGET=prod`.
- `--dry-run` is the default: prints census, demotion candidates with
  per-customer reasons, counts. Writes require `--apply`.
- Idempotent + resumable; every conversion logged to the mapping table.
- Post-run invariants: `customers_before = customers_after + demoted`; every
  demoted id has a lead; zero orphaned FKs; sample spot-check.
- Tightening tally for every dual-shape site touched during the transition
  (UL migration vocabulary).

**Blast radius (why Track 2 is post-launch):** Phase B re-points everything
that reads "leads" out of customers today — leads pipeline UI, dispatcher
LeadsPool, CASL visibility scoping. That is the bulk of Track 2's work.

## Out of scope

- Phase-2 down-funnel tail (Contact/MeetingComplete/ProposalSent/Purchase) —
  remains `meta-capi-phase2-handoff.md`, volume-caveated.
- Google Ads integration (naming keeps the door open; nothing built).
- Any custom Meta events; any Events-Manager custom conversions.
- Track 2 execution (this spec defines it; its plan is written when it runs).

## Track-1 implementation surface (for writing-plans)

1. `convention-map.ts` / `use-funnel-tracking.ts` — renter gate on
   `CompleteRegistration`.
2. `funnels.router.ts` — retire `trackFunnelEvent`; new draft-lead
   track-step procedure; `submitLead` linking (+ `metaLeadEventId`).
3. Schema — `leads` table + two additive customers columns (`leadId`,
   `metaScheduleSentAt`) (dev push via `pnpm db:push:dev`).
4. Leads DAL + entity scaffold (entity-first organization).
5. Meetings entity `hooks.create.after` → guard checks → QStash job variant →
   `meta-sync` Schedule method (user_data rebuilt from lead via DAL).
6. Draft-prune scheduled job.
7. Docs: meta DOCS, scripts/meta DOCS, UL entries.
8. Preflight `pnpm lint && pnpm tsc`; real-browser validation runbook.
