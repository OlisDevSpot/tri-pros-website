# Research findings: Meta Pixel + CAPI event-model redesign (2026-07-26)

> Input to the design session mandated by
> `docs/plans/2026-07-26-funnel-event-model-redesign-handoff.md`. Produced by
> three parallel research agents (ladder strategy / delayed CRM→CAPI mechanics /
> per-step analytics), 2025–2026 sources, official Meta docs preferred. Each
> claim below carries the researching agent's confidence; unverified items are
> flagged. **This is research, not the design spec** — the brainstorm still
> resolves the open decisions in §4.

## 1. Headline findings (all three agents converge)

1. **Per-event "weight" does not exist.** Meta optimizes toward whichever
   single event the ad set selects; there is no ranking/weighting surface
   anywhere in the stack. AEM event prioritization (the old 8-slot ranking) was
   removed (~mid-2025, Events Manager tab retired). The premise behind
   "CompleteRegistration at PII = very high weight" has no mechanism. (High)
2. **Do not repurpose `Purchase` for appointment-set.** `Purchase` requires
   `value`/`currency` (bare fires → diagnostics warnings; fake values poison
   future value optimization / ROAS). Its cross-advertiser prior is
   ecommerce-buyer-shaped, not appointment-booker-shaped. `Schedule` is the
   documented standard event for exactly this: "when a person books an
   appointment to visit one of your locations." Keep `Purchase` reserved for
   contract-signed with a real value, later. (High)
3. **Keep `Lead` at PII submit as THE optimization event.** Learning phase
   wants ~50 conversions/ad set/week. At ~$58/day we produce roughly ~35
   renter-gated Leads/week *total* (borderline, split across ad sets);
   appointment-sets would be ~8–15/week → permanently learning-limited. The
   recognized low-volume pattern is exactly what we already run:
   high-volume optimization event + quality gate (the renter gate). Moving
   `Lead` to the thank-you page is a strict downgrade (volume loss, browser-only
   fragility, breaks the lead-tooling event name). (High)
4. **The Lead↔CompleteRegistration swap is rejected by the evidence.**
   "Lead at the real form submit + deeper events later" IS the recognized
   practitioner pattern; the proposed swap is not, and rests on the
   nonexistent weighting mechanism. (High)
5. **Meta's purpose-built CRM-outcome tool is ineligible for us.** The
   Conversion Leads performance goal requires Instant Forms lead ads (not
   website funnels), ≥200 leads/month, CRM stage within 28 days at 1–40%
   conversion, daily uploads keyed by Meta `lead_id`. Website-lead pilots
   exist but no verified GA. Don't chase it unless we ever run Instant Forms.
   (High on requirements)
6. **CRM appointment-set → server-only CAPI event, added now as
   sent-but-not-optimized.** Reporting, seed audiences, cost-per-appointment
   custom conversion; becomes the optimization event only if volume ever
   approaches ~50/wk/ad set (optional single probe ad set after ~4 weeks of
   data is the cheap empirical test).

## 2. Delayed CRM→CAPI mechanics (appointment-set slice)

- **Timing.** The 7-day limit is `event_time` → POST time, not click → event.
  Fire within minutes of the CRM booking action with `event_time` = actual
  booking moment and the API window is never a problem. Never backdate
  `event_time` to the click/lead moment (accuracy obligation + corrupts lag
  reporting). Batch/replay paths must hard-cap at now−7d and split batches
  (one stale row rejects the whole request). (High)
- **`action_source: 'website'`** — `'crm'` is NOT in the documented enum
  (website/app/email/phone_call/chat/physical_store/system_generated/
  business_messaging/other). `system_generated` means automatic conversions
  (e.g. subscription renewal) and severs the web-journey join. Website events
  require `event_source_url` (use the funnel URL — must pass the dataset
  domain allow-list). The Offline Conversions API is dead (May 2025, merged
  into unified Datasets) — irrelevant, we're already on the target
  architecture. (High on enum; Medium-High on recommendation)
- **Attribution reality (new, load-bearing):** as of **Jan 12, 2026** the max
  attribution window is **7-day click + 1-day view** (28-day and 7-day-view
  removed). Appointments set >7 days after the click are **permanently
  invisible to Meta attribution** regardless of match quality — CRM-side
  cohort reporting is the only place the tail exists. Keep ad sets on
  7d-click/1d-view. (Medium-High)
- **Matching:** send the full persisted bundle — hashed em/ph/fn/ln/ct/st/zp/
  country + hashed `external_id` (leadId) + `fbp` + `fbc` (send even if stale;
  timestamp = first-observed fbclid moment, fbclid unmodified) + IP/UA
  captured at funnel submit. Expected EMQ **7–9 server-only**; EMQ ≥6 remains
  the "good" benchmark, 7+ the practical target. EMQ measures matchability,
  not attribution. Old fbc values are flagged (~90d) but not rejected. (Medium)
- **Dedup:** `event_id` is NOT required for server-only events; send a
  deterministic one anyway (`appt-set-<crmAppointmentId>`) — free 48h retry
  idempotence and future-proofs a dual-fire upgrade (identical
  event_id+event_name within 48h merges cleanly; keep retry horizon <48h).
  (High — official dedup doc)
- **Optimization eligibility:** server-only CAPI events are first-class
  optimization targets; the constraint is volume, not channel. (Medium-High)
- Reference payload shape: see the delayed-CAPI agent report (recorded in the
  session transcript 2026-07-26); essentials above are complete.

## 3. Per-step analytics layer

- **Signal dilution from non-optimized mid-funnel events is unsubstantiated**
  (no official statement, no credible measured harm). Real hazards:
  optimizing FOR a thin event, and naming/hygiene clutter. (Medium-High)
- **Custom > overloaded standard for mid-funnel moments.** Cross-advertiser
  priors only matter for the optimization event; repurposing
  `InitiateCheckout`/`FindLocation` for ZIP just pollutes semantics. Meta's
  own guidance: don't misuse standard events; when none fits, custom is
  correct. Names ≤50 chars; parameter keys used in audiences must not contain
  spaces. (High on rules)
- **One event per stage boundary, not per micro-step** — first-party per-step
  persistence already owns fine-grained drop-off; Meta mid-funnel counts are
  consent/iOS-lossy, and two adjacent noisy counts make a garbage ratio.
- **Custom conversions = the cost-per-stage mechanism.** 100/ad account; rules
  filter on event + URL + parameters (incl. custom params); Total/Cost columns
  in Ads Manager via Customize Columns; **not retroactive — create the day
  instrumentation ships**. Since Sept 2025 Meta auto-flags CCs whose names
  imply financial/health status — keep neutral step semantics. Custom events
  are directly selectable as performance goals (no CC wrapper) but don't
  appear as Ads Manager *columns* until once used as a goal — CCs sidestep
  that. (High, except column quirk Medium)
- **Ads Manager cannot break down by parameters** — `content_name`/`step_*`
  params are write-only for reporting unless materialized into a CC. Our
  campaign-per-trade structure already carries the trade split. Cost per
  landing-page view is a native column (zero event work).
- **Join key:** persist the shared `event_id` on the server-side step record —
  deterministic join between Meta-side events and first-party funnel data.
- Recommended params on every event: `content_category` (trade),
  `content_name` (funnel slug), plus custom `step_kind`/`step_index`.

## 4. Recommended ladder (research consensus — design session to ratify)

| Stage | Event | Type | Fire | Role |
|---|---|---|---|---|
| Funnel load | `PageView` (+ native LPV column) | standard | browser (as-is) | baseline / cost-per-LPV |
| First interaction | `ViewContent` (as-is) — optionally add `FunnelEngaged` custom | standard/custom | browser (dual-fire optional) | engagement audience + CC column |
| ZIP accepted | `ZipQualified` (custom, new) | custom | see open Q3 | qualification moment; CC for cost-per-ZIP column |
| PII submit | `Lead` — **unchanged**, renter-gated, dual-fire | standard | browser+CAPI shared event_id | **THE optimization event** |
| Confirmation | `CompleteRegistration` (as-is) | standard | browser | reporting only |
| In-funnel datetime | `Schedule` (as-is) — see open Q1 | standard | dual-fire | immediate high-intent signal |
| CRM appointment-set | `Schedule` or custom `AppointmentSet` — see open Q1 | standard/custom | server-only CAPI (§2 payload) | ground truth; CC cost-per-appointment; future optimization candidate |

Custom conversions day-one: `Funnel Engaged`, `ZIP Qualified`, appointment
event. Saved Ads Manager column preset ("Funnel Ladder"): LPV cost →
ViewContent → CC:Engaged → CC:ZIP → Cost/Lead → Cost/Schedule →
Cost/Appointment.

### Open decisions the brainstorm must still resolve

1. **`Schedule` name collision — RESOLVED by code verification (2026-07-26).**
   No funnel emits `Schedule` today: the `trackFunnelEvent` seam in
   `funnels.router.ts` is dormant ("no funnel emits 'Schedule' yet (no
   datetime step)") and no `firePixel('Schedule')` call site exists. The name
   is unclaimed → `Schedule` = CRM appointment-set, full stop. If an in-funnel
   datetime step ever ships, it emits a DIFFERENT event (e.g. custom
   `AppointmentRequested`) — a requested slot is not a set appointment.
2. **`FunnelEngaged` vs keeping bare `ViewContent`** for the engagement rung
   (ViewContent already fires on first answer; a second custom event may be
   redundant).
3. **Browser-only vs dual-fire for the new mid-funnel events.** Handoff
   constraint says dual-fire only for optimize/bid events; dual-fire would
   improve count accuracy for cost columns, but pre-PII events carry weak
   match keys (fbp/fbc/IP/UA only; +zp for ZIP). Decide per event.
4. **Sequencing plan** around Showcase launch (see §5) — exact dates/windows.
5. **Ubiquitous-language entries** for the final vocabulary (incl. reserving
   `Purchase` = contract-signed w/ value) + supersession banner on
   `docs/plans/meta-capi-phase2-handoff.md` (its Schedule slice is absorbed
   here; its Contact/MeetingComplete/ProposalSent/Purchase tail remains
   future).

## 5. Sequencing rules (mid-flight changes)

- Changing an ad set's optimization event = "significant edit" → **full
  learning reset**. Moving where a same-named event fires = **invisible signal
  drift** (worse — no UI trace, corrupts historical comparability, CCs,
  audiences). (High/Medium)
- Therefore: **launch Showcase on the current proven ladder**; add new events
  **additively**, dual-running 1–2 weeks with Events Manager validation
  (volume parity, dedup, EMQ 8–10, no diagnostics) before anything in Ads
  Manager references them; **fresh ad sets** (short overlap, then wind down)
  if the optimization event ever changes; batch structural edits, then ≥7 days
  hands-off.
- 2026 environment notes: Incremental Attribution = measurement-mode sanity
  check only, never optimize on it at our volume; Jan-2026 window change makes
  period-over-period comparisons across January look like a conversion drop;
  a reported Mar-2026 "engage-through" click redefinition is third-party-only
  — verify before relying. Dataset Quality API (programmatic EMQ) worth
  wiring into audit tooling — verify endpoint first (Low-Medium).

## 6. Requirements — ratified next steps (Oliver sign-off 2026-07-26)

Phased, requirements-based. R-numbers are stable references for the design
spec / plan. Sequencing rule: **all events ship before the Showcase campaign
activates** — adding events mid-campaign is the invisible-drift scenario.

### Phase 0 — Documentation alignment ✅ DONE 2026-07-26
- **R0.1** ✅ Handoff stale rows fixed (datetime step nonexistent; `Schedule`
  unclaimed; first-party capture scope corrected to post-PII-only).
- **R0.2** ✅ Ratified-decisions banner on the redesign handoff.
- **R0.3** ✅ Supersession banner on `meta-capi-phase2-handoff.md` (Schedule
  slice absorbed here; Contact/MeetingComplete/ProposalSent/Purchase tail
  remains that doc's future scope, volume caveat noted).

### Phase 1 — Design spec (brainstorm session; spec → `docs/superpowers/specs/`)
- **R1.1** CRM trigger point for `Schedule`: which entity transition means
  "appointment set" (meeting created? `pipelineStage` transition?) — pick ONE
  chokepoint via the owning entity's hooks (entity-owns-its-mutations).
- **R1.2** `ZipQualified` fire site: step-kind binding in `convention-map.ts`
  vs the ZIP gate's submit site; exact params.
- **R1.3** Quality gate scope: the renter gate must also cover `Schedule`
  (a renter appointment must not feed a future optimization event).
- **R1.4** Event parameter set finalized: `content_category`, `content_name`,
  custom `step_kind`/`step_index`; `event_id` persisted on the lead record
  (Meta↔first-party join key).
- **R1.5** Scope the pre-PII first-party step-event capture (Option A:
  anonymous session id + fire-and-forget step-advance endpoint + append-only
  table, linked to lead at PII) — decide build-now vs fast-follow slice.
- **R1.6** Ubiquitous-language entries: `Schedule` = CRM appointment-set;
  `AppointmentRequested` reserved for any future in-funnel datetime step;
  `Purchase` reserved for contract-signed with real value/currency.

### Phase 2 — Implementation (pre-launch; `pnpm lint && pnpm tsc`; stage by path)
- **R2.1** Browser: `ZipQualified` custom event, browser-only, convention-bound.
- **R2.2** Browser/server: persist the Lead `event_id` on the lead record.
- **R2.3** Server: CRM `Schedule` CAPI slice — entity hook → QStash job →
  meta-sync → CAPI. Payload per §2: `action_source: 'website'`,
  `event_source_url` = funnel URL, `event_time` = actual booking moment
  (never backdated), `event_id` = `appt-set-<crmAppointmentId>`, full
  persisted match-key bundle (target EMQ ≥7). Retry horizon <48h; any
  batch/replay hard-capped at now−7d.
- **R2.4** Renter gate applied to `Schedule` (per R1.3).
- **R2.5** Retire or repoint the dormant `trackFunnelEvent` browser-`Schedule`
  seam in `funnels.router.ts` (the name now belongs to the CRM event).
- **R2.6** Docs in the same PR: `providers/meta/DOCS.md` (Schedule invariant:
  server-only exception to dual-fire, dedup rationale), `scripts/meta/DOCS.md`
  (optimization ladder + the campaign-duplication checklist as a runbook),
  ubiquitous-language entries (R1.6).
- **R2.7** Test-isolation invariants untouched: host-gated browser pixel,
  `test_event_code` CAPI channel, never verify headless.

### Phase 3 — Launch-day ops (Meta UI, manual, day of deploy)
- **R3.1** Create custom conversions THE DAY the code deploys (not
  retroactive): `ZipQualified`, `Schedule` (appointment). Event-name rules,
  NO URL filters (so future funnels inherit them). Neutral names (Sept-2025
  sensitive-category flagging).
- **R3.2** Build + save the "Funnel Ladder" Ads Manager column preset:
  Spend → LPV cost → ViewContent cost → CC:ZipQualified cost → Cost/Lead →
  CC:Schedule cost.
- **R3.3** Events Manager validation in a REAL browser (Test Events "Open
  Website" + Pixel Helper): Lead dedup shows Browser+Server merged, EMQ ≥7,
  no diagnostics warnings.
- **R3.4** Launch optimizing on `Lead`, 7-day-click/1-day-view; hands off ad
  sets ≥7 days.
- **R3.5** Pre-commit target ranges per ladder rung (written down before
  launch — thresholds, not vibes).

### Phase 4 — Post-launch operating cadence
- **R4.1** Weekly: Funnel Ladder preset at ad level (leak localization) +
  Events Manager health (EMQ, dedup, diagnostics).
- **R4.2** Monthly: first-party cohort report — true cost per appointment
  (incl. >7-day tail invisible to Meta) by campaign/ad via fbclid/UTM; track
  the Meta-vs-CRM appointment delta as its own metric.
- **R4.3** Fast-follow: pre-PII step-event capture (R1.5 Option A) if not
  built in Phase 2.
- **R4.4** ~4 weeks in (optional): one probe ad set optimized on `Schedule`;
  expect learning-limited; kill if it loses to Lead-optimized sets.
- **R4.5** Future campaigns: duplication checklist (declare `contentCategory`
  → ladder self-wires; campaign spec `optimizationEvent: 'LEAD'`; apply
  column preset; one Events Manager validation pass; baseline rung targets
  after ~2 weeks).

## 7. Source highlights

Official: Meta Pixel standard-events reference; CAPI server-event parameters
(action_source enum, 7-day event_time rule, event_source_url); fbp/fbc
parameter doc (format, 90-day storage, case-sensitive fbclid); dedup doc
(event_id+event_name, 48h window, server-only exemption); Conversion Leads
CRM integration guide (Instant-Forms-only, 200/mo, 28d/1–40% stage rules);
conversion-tracking doc (100 CCs, 50-char names, CC optimization, Sept-2025
sensitive-CC flagging); offline-events doc (Datasets merge, daily-upload
guidance).

Secondary (2025–2026): Jon Loomer (AEM removal, value-optimization
requirements, attribution 2026, custom vs standard); DEPT/Conversios (AEM
removal); MarTech Oct-2025 (Meta lead-gen roadmap: Zapier/Salesforce CAPI
push); LeadsBridge/LeadSync/GoHighLevel (Conversion Leads ecosystem);
Dataslayer/Jetfuel (Jan-2026 attribution windows); learning-phase consensus
(Pigeon Digital, Benly, AdLibrary, Niblin, GoMarble, Cometly, AdsX);
CustomerLabs/Triple Whale/TAGGRS (EMQ benchmarks); Watsspace/Stape (fbc
staleness); AdAmigo/DashThis/feature.fm/Motion (custom-conversion mechanics);
Segment/CommandersAct (custom_data passthrough). Full URL lists live in the
three agent reports in the 2026-07-26 session transcript.
