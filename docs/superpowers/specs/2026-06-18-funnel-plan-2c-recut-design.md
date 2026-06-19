# Showcase Funnel — Plan 2c (re-cut): Enrichment + Confirmation + Location reveal

**Status:** Design approved (brainstorm 2026-06-18). Ready for implementation plan.
**Owner:** Oliver P
**Supersedes:** `docs/superpowers/plans/2026-06-18-showcase-funnel-plan-2c-enrichment-confirmation.md` (kept for its *business needs*; its *implementation* is re-derived here against the engine we actually shipped).
**Parent spec:** `docs/superpowers/specs/2026-06-17-showcase-funnel-system-design.md` (§2 flow, §5 lead plumbing, §6 measurement).

---

## 0. Why a re-cut

Since the original 2c was drafted, the funnel engine converged on a reusable, content-free architecture (plans 2a/2b + the landing-polish track). The drafted 2c captured **what** the business needs post-PII, but several of its **how** details are now stale. This spec keeps the needs and re-derives the design against the real system.

### System decisions that are the source of truth (the "how")

1. **Headless, content-free engine.** `useFunnelEngine` + `FunnelEngine` know nothing about any trade. A funnel is data: a `FunnelSpec` (`hero`, `theme`, `pixel`, `steps[]`, optional `landing.blocks`).
2. **Typed step model, lockstep-enforced.** A new kind extends **four** things together — `AnswerByKind` + `ContentByKind` + the `FunnelStep` union + `STEP_REGISTRY` — with `tsc` exhaustiveness as the safety net. Exactly one dispatch cast (in the engine). Input-less kinds use `never` as their answer.
3. **One answer slot per step id.** `FunnelAnswers` keyed by step id; composites are objects; a single `setValue(AnswerOf<S>)`. **No `setAnswers`.** Cross-step reads via `answers`; funnel-level data via `ctx` (slug/offer/theme/utm).
4. **Two render modes.** `isFirst` → `FunnelLanding` (long-scroll hero + embedded Q1 + marketing blocks). After the first advance → focused single-column shell with progress + **generic Back/Next chrome**. Step components render their *own* CTA only when they need a custom action (form submit); otherwise they rely on the shell's Next, or self-advance (card-select micro-commitment).
5. **Headless step library (Seam A).** Shared steps ship as importable prebuilt objects co-located with their component (`ZIP_STEP`, `PII_STEP`), spread-overridable per funnel. Trade-specific steps (layout, ownership, enrichment) are inline card-selects in the config.
6. **Backend = a dedicated public `funnelsRouter`.** `src/trpc/routers/funnels.router.ts` holds `phoneLookup` + `submitLead` on `baseProcedure`, with Upstash limiters + `clientIp` + `SYSTEM_CONTEXT`, routing through `customerIntakeService`. PII creates the lead and writes `PiiAnswer = { leadId }`.
7. **Lead-first, enrich-second + resilience.** Lead created at PII; everything after is best-effort enrichment that must never block the experience.

### Stale "how" in the original 2c (corrected here)

- **Wrong router/service.** It put `enrichFunnelLead` on `customersRouter.business` + `customer-intake.service`. **Correct home: `funnelsRouter`**, mirroring `submitLead`.
- **Stale `StepProps`.** Its component sketches predate `isAnswered` and the generic Back/Next shell; the draft's steps render their own Back buttons → would double-render nav.
- **Appointment dropped from 2c.** The `datetime` step is deferred (see §7).
- **Region map dropped.** Replaced by a lighter city/county badge reveal (see §3).

---

## 1. Scope

**In 2c:**
- Enrichment questions (4 card-selects, capture-only)
- Confirmation step (new `confirmation` kind, terminal)
- `enrichFunnelLead` persistence (guarded public mutation)
- Location "qualified" reveal — animated city/county badge (NOT an SVG map)

**Deferred to plan 3b/4:** appointment / `datetime` step + `scheduledFor` capture + Meta `Schedule` event. Bundled with the measurement work because `Schedule` fires on time-selection (parent spec §6.3).

**Resolved kitchen flow:**

```
Landing[hero + Q1 layout] → ownership → location → pii(creates lead)
  → homeType → age → scope → timeline → confirmation
```

---

## 2. Enrichment — config-only, zero new kinds

Four `card-select` steps appended to `kitchens.ts` `steps[]`, in order **homeType → age → scope → timeline** (property facts first, project intent second). They inherit the existing micro-commitment **auto-advance on first tap**. Answers land keyed by step id (`answers.homeType`, `answers.age`, `answers.scope`, `answers.timeline`) as plain strings. All **capture-only** — no qualification gating in 2c (commercial/mobile-home are recorded, not filtered).

| Step id | Question | Options (id → label) |
|---|---|---|
| `homeType` | What kind of home is it? | `single-family` → Single-family · `condo` → Condo · `mobile-home` → Mobile home · `commercial` → Commercial |
| `age` | How old is your kitchen? | `0-5` → 0–5 years · `5-15` → 5–15 years · `15-plus` → 15+ years · `original` → Original / never renovated |
| `scope` | What are you picturing? | `full-gut` → Full gut remodel · `cabinets-counters` → Cabinets + counters · `refresh` → Cosmetic refresh · `not-sure` → Not sure yet |
| `timeline` | When would you want to start? | `asap` → ASAP · `1-3` → 1–3 months · `3-6` → 3–6 months · `exploring` → Just exploring |

---

## 3. Location "qualified" reveal — no map

Replace the placeholder in `location-step.tsx`'s `qualified` phase with an animated **"✓ Your area qualifies — {city}, {county}"** pin/badge, read from the resolved `LocationAnswer` (`value.city` / `value.county`). Reduced-motion-gated via `FUNNEL_TRANSITION`. **Drops `socal-regions.ts` and any county→region mapping entirely.** No new step kind; this is a render change inside the existing `location` step. Advance stays on the shell Next (the step keeps writing its `LocationAnswer`, so `value != null` surfaces the shell's Next).

---

## 4. Confirmation step — new `confirmation` kind (Seam A)

New component `ui/steps/confirmation-step.tsx` exporting `ConfirmationStepView` + `CONFIRMATION_STEP` (prebuilt, spread-overridable). Registered in `STEP_REGISTRY`.

**On mount (once):** fire `enrichFunnelLead` fire-and-forget, reading `answers.pii.leadId` + the four enrichment answers. Guard with a `useRef` so it fires exactly once.

**Before/after proof (true pairs):**
- `showroomDisplay.getAll` → filter to kitchen projects via notion scopes (same mechanism as the bento `PortfolioBlock`).
- Take the top ~3 kitchen projects; for each call `showroomDisplay.getDetail({ accessor: project.accessor })` (capped — a few parallel `useQuery`s).
- Render a before→after pair for each project where **both** `media.before[0]` and `media.after[0]` exist; skip projects missing either phase.
- **Fallback (thin coverage):** if zero usable pairs assemble, fall back to the finished-hero **bento `PortfolioBlock`** (kitchen-filtered, fallback-padded) so confirmation never looks empty.

**Copy:** thank-you headline + "what happens next" (we review fit and call within 24 hours) + scarcity reinforcement (limited Showcase spots).

**Terminal nav (proposed generic engine rule):** suppress the focused shell's Back/Next footer when the current step has **no next** (`!engine.hasNext`), so the thank-you is final. Trade-agnostic — not a `confirmation`-specific special-case; in a linear funnel only the last step satisfies it.

---

## 5. Backend — `enrichFunnelLead` (the correction)

Public `baseProcedure` on **`funnelsRouter`**, next to `submitLead`, reusing its limiter / `clientIp` / `SYSTEM_CONTEXT` / `customerIntakeService` conventions.

**Input:** `{ leadId: uuid, enrichment: { homeType?, age?, scope?, timeline? } }` (each enrichment field `string | null`, all optional). No `scheduledFor` in 2c (appointment deferred).

**Security model** (the one new public write surface — review before merge):
- The **`leadId` UUID is the capability** — unguessable, returned to the client only at PII.
- **IP rate-limited** — new Upstash limiter, prefix `'funnel:enrich'`, sane window (mirror `submitRatelimit`).
- The service **loads the customer, guards `leadMetaJSON.source.kind === 'funnel'`**, and **only patches** the `source.enrichment` allowlist. It can never mutate non-funnel customers or any field outside the allowlist. No PII / status / ownership writes.

**Schema:** extend the leadMeta `source` `kind: 'funnel'` variant with optional `enrichment: { homeType, age, scope, timeline }` (each `string | null`). The leadMeta patch goes through a **DAL mutation** (services never call `db.*`); do **not** set `updatedAt` manually (schema-helper handles it).

---

## 6. Hook — `useEnrichLead`

`hooks/use-enrich-lead.ts`: thin wrapper over `useMutation(trpc.funnelsRouter.enrichFunnelLead.mutationOptions())` returning a `(args) => void` that calls `mutation.mutate(args, { onError: () => {} })` — best-effort, never awaited, errors swallowed so confirmation never breaks.

---

## 7. Out of scope (later plans)

- **Plan 3 (measurement):** Meta Pixel + CAPI dual-fire (`PageView` / `ViewContent` / `Lead` / `CompleteRegistration`).
- **Plan 3b/4 (appointment):** `datetime` step kind + `scheduledFor` capture + the `Schedule` event (paired with measurement because `Schedule` fires on time-selection).
- **Plan 4+:** bathroom + complete-interior funnels (config-only, reusing this engine + step library); trade icon polish; richer confirmation media; before/after enhancements once kitchen `before`-media coverage is reliable.

---

## 8. File touch map

```
src/shared/entities/customers/schemas/index.ts          MODIFY — enrichment{} on the 'funnel' source variant
src/trpc/routers/funnels.router.ts                       MODIFY — enrichFunnelLead public procedure + 'funnel:enrich' limiter
src/shared/services/customer-intake.service.ts           MODIFY — enrichFunnelLead service method (load → guard funnel → patch allowlist)
src/shared/entities/customers/dal/server/mutations.ts    MODIFY/CREATE — leadMeta patch mutation (if none fits)
src/shared/domains/funnels/
├── types.ts                                              MODIFY — add 'confirmation' kind (lockstep: AnswerByKind/ContentByKind/FunnelStep)
├── constants/
│   ├── step-registry.ts                                  MODIFY — register 'confirmation'
│   └── kitchens.ts                                        MODIFY — append homeType/age/scope/timeline + CONFIRMATION_STEP
├── hooks/use-enrich-lead.ts                              CREATE — fire-and-forget enrichment hook
├── ui/funnel-engine.tsx                                  MODIFY — suppress footer nav when !hasNext (generic terminal rule)
└── ui/steps/
    ├── location-step.tsx                                 MODIFY — city/county badge reveal in qualified phase
    └── confirmation-step.tsx                             CREATE — ConfirmationStepView + CONFIRMATION_STEP (before/after + fire enrichment)
```

---

## 9. Global constraints (same as 2a/2b)

No test runner — `pnpm tsc` + `pnpm lint` + runtime browser smoke; **never `pnpm build`**, never `pnpm db:push` (prod — use `db:push:dev`). Named exports; `import type` top-level; braces+newline `if`; sorted imports; `@/` → `src/`; pathspec commits on `main`; `shared` never imports `features`; `schemas/` sibling of `lib/`; backend **tRPC → service → DAL** (no `db.*` in routers/services); one component per file; no barrels; motion respects reduced-motion. Adding a kind is a lockstep change — don't suppress the exhaustiveness error with casts.

## 10. Acceptance (end-to-end smoke)

1. Kitchen funnel runs hero → … → confirmation; the 4 enrichment card-selects auto-advance on tap.
2. Location qualified phase shows the animated "{city}, {county}" badge (reduced-motion: static).
3. Reaching confirmation fires `enrichFunnelLead` (network 200, fire-and-forget); the thank-you renders regardless.
4. DEV DB: the customer's `leadMetaJSON.source.enrichment` has `{homeType, age, scope, timeline}`; `source.kind:'funnel'` unchanged.
5. Confirmation renders before/after pairs for kitchen projects that have both phases; falls back to the bento gallery when none do.
6. Terminal confirmation shows **no** Back/Next footer.
7. Negative: `enrichFunnelLead` with a random UUID, or a non-funnel customer id, is refused (guard holds).
8. `localStorage` answers: `homeType/age/scope/timeline` are strings; `pii` is `{leadId}`; no flat enrichment keys (proves no `setAnswers`).
