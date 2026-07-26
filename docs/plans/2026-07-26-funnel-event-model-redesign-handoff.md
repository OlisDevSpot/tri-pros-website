# Handoff: Funnel Event-Model Redesign (Pixel + CAPI + KPI analytics)

> **How to use:** open a fresh session and paste/point it at this doc. It is a
> self-contained brief. Start with `superpowers:brainstorming`; the deliverable
> is a design spec + implementation plan, then implementation.
> Origin: Showcase campaign launch session 2026-07-26 (spec:
> `docs/superpowers/specs/2026-07-26-showcase-campaign-launch-design.md` §6).

## Mission

Redesign the funnel's Meta event ladder (browser Pixel + server CAPI) so that
(a) each stage of the user journey emits the right event with the right weight,
and (b) the event stream supports the KPI/drop-off analytics we will run the
ad program on. Then implement it.

## Read first (in order)

1. `src/shared/services/providers/meta/DOCS.md` — measurement invariants
   (dual-fire dedup, event_id threading). Canonical.
2. `docs/marketing/showcase-offer.md` — the offer; renter gating rationale.
3. `src/shared/domains/funnels/lib/tracking/` — all five files; this is the
   entire browser emitter surface. Small.
4. `src/shared/domains/funnels/lib/tracking/lead-qualification.ts` —
   `firesLeadOptimization` renter gate (must move WITH whatever event Meta
   optimizes on).
5. Memory: `project-meta-pixel-capi.md`, `project-funnel-pixel-isolation.md`
   (⚠️ never verify the pixel headless — real browser / Pixel Helper only).
6. `scripts/meta/DOCS.md` — the campaign side consuming these events
   (optimization event = `LEAD` today).

## Current state (verified in code 2026-07-26)

| Stage | Event today | Where |
|---|---|---|
| Funnel page load | `PageView` | `pixel-loader.tsx` |
| First answer on any step | `ViewContent` (browser) | `use-funnel-tracking.ts` |
| ZIP submitted | — nothing — | |
| PII form submitted | `Lead` (dual-fire browser+CAPI, renter-gated) | PII step submit site |
| Confirmation step reached | `CompleteRegistration` (browser-only) | `convention-map.ts` kind→event |
| Datetime step submitted | `Schedule` (dual-fire) | datetime step submit site — verify how live/used this is |
| Appointment set in CRM (post-funnel) | — nothing — (CAPI Schedule slice was planned, never built: `docs/plans/meta-capi-phase2-handoff.md`) | |

Convention emitter binds events to step *kinds* (not funnel ids) so N funnels
need zero per-funnel wiring — preserve that property.

## Oliver's desired ladder (design input, not final)

1. Creative click → funnel lands: `PageView`.
2. First interaction with the funnel: an engagement event.
3. ZIP entered: an event (service-area qualification moment).
4. **PII form submitted: `CompleteRegistration`** — "very high weight;
   everything past PII is enrichment."
5. **Confirmation/thank-you reached: `Lead`.**
6. Considering: `Schedule` server-side via CAPI when the appointment is set in
   the CRM (long after the user left the funnel).
7. Considering: **`Purchase` when the appointment is set** — "that's the event
   we're targeting"; send enough via CAPI to eventually optimize on it.

## Decision points the design must resolve (with context)

1. **Lead↔CompleteRegistration swap trade-off.** Today `Lead` fires at PII
   submit; the live ad sets optimize on `LEAD`. Moving `Lead` to the thank-you
   page reduces its volume by whatever drops during enrichment steps and
   changes what Meta trains on mid-flight. Options include: keep `Lead` at PII
   and add `CompleteRegistration` (or a custom event) at confirmation; do the
   full swap; or fire `Lead` at PII AND a higher-weight event later. Whatever
   is chosen, the **renter gate must guard the optimization event**, and the
   campaign spec's `optimizationEvent` must stay consistent with the ladder.
   Sequencing: the Showcase campaign launches on the current model; ideally
   ship the remap before/near activation to avoid mid-learning semantic shift.
2. **Purchase semantics.** The original pipeline mapping reserved `Purchase`
   for contract-signed. Oliver now proposes `Purchase` = appointment-set.
   Decide one meaning, document it in ubiquitous language, and leave room for
   the contract event (custom event? value-bearing Purchase later?). Note:
   standard-event semantics matter to Meta's models — weigh
   `Schedule` (standard, semantically exact for appointments) vs `Purchase`
   (heavier weight, semantically off) honestly.
3. **ZIP + engagement events.** Standard vs custom events (e.g.
   `ZipSubmitted`), bound by step kind in `convention-map.ts`. Custom events
   can back Events Manager custom conversions for per-step cost columns.
4. **Dual-fire vs browser-only per event.** Anything Meta optimizes or bids on
   deserves the CAPI twin + event_id dedup; pure-analytics steps may stay
   browser-only. Match-key quality for post-funnel CAPI events (hashed
   email/phone/name/ZIP + fbc/fbp persisted from click through CRM) — target
   EMQ ≥ 6.
5. **KPI/analytics layer.** Oliver will manage the program on: cost per
   landing-page view, cost per lead, per-step drop-off rates, cost per
   appointment, and step-localized funnel diagnostics ("pinpoint which step —
   creative → funnel step → appointment → sale — is leaking"). Decide per
   metric whether it comes from Meta (events + custom conversions + Ads
   Manager columns) or first-party (funnel answers are already persisted
   server-side — internal step-timing/drop-off analytics may be far richer
   than pixel data). Design the event parameter set (funnel slug, trade,
   step id/index, event_id) so both sides can join.
6. **CAPI Phase-2 overlap.** `docs/plans/meta-capi-phase2-handoff.md` covered
   the server-side Schedule slice — fold it into this redesign or supersede it
   explicitly (banner on the old doc).

## Constraints

- Test-vs-live pixel isolation (browser host-gate + `test_event_code`) must
  keep working; never verify with a headless browser.
- Renters are ingested as CRM leads but must never fire the optimization
  event.
- Convention-over-wiring: events bind to step kinds, not funnel instances.
- The campaign engine (`scripts/meta/`) consumes `optimizationEvent` per ad
  set — if the ladder changes the optimization event's name or firing point,
  update `scripts/meta/DOCS.md` and the campaign spec in the same PR.
- `pnpm lint && pnpm tsc` preflight; work on main, stage by path.

## Deliverables

1. Design spec (brainstorm → `docs/superpowers/specs/`) resolving the six
   decision points.
2. Implementation plan + implementation (tracking lib, CAPI slices, CRM
   trigger for appointment event, Events Manager custom conversions runbook).
3. Doc updates: measurement invariants DOCS, `scripts/meta/DOCS.md`,
   ubiquitous-language entries for the final event vocabulary, supersession
   note on `meta-capi-phase2-handoff.md` if absorbed.
