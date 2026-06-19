# Headless Funnel Engine — Design Spec

**Date:** 2026-06-19
**Status:** Approved (design); pending implementation plan
**Domain:** `src/shared/domains/funnels/`
**Branch context:** authored on `feat/funnel-ui-revamp`; implementation should land on its own branch(es) — this is an architecture effort, not part of the UI polish batch.

---

## 1. Purpose & scope

Make the funnel engine **reusable and scalable** so that creating a new funnel feels like a *headless authoring* experience: a developer composes a funnel from shared building blocks, customizes the ones that need trade/offer-specific content, and injects fully bespoke ones — without editing global type unions or registries. Add the missing **conditional-logic / disqualification** capability. Capture all cross-funnel invariants and the "how to instantiate a new funnel" recipe in canonical documentation.

A **funnel = trade (slug) + offer**, expressed as a `FunnelSpec` config object (e.g. `kitchens.ts`). This spec **extends** the existing engine; it does not rebuild it.

### In scope
- Tier-3 escape hatch for **custom blocks and steps** (`defineBlock` / `defineStep`).
- Making **shared blocks truly customizable per funnel** (Tier-2 fix).
- **Per-step branching** + **disqualification** engine with per-rule DQ behavior.
- A first-class **`DOCS.md`** documenting invariants, business rules, and authoring.

### Out of scope (YAGNI — explicitly deferred)
- Serializable / JSON / CMS-authored funnels. **Decision: funnels are developer-authored in TypeScript.** Logic is functions; configs are not required to be JSON-serializable. No Payload-authored layer, no JSON-Logic rule DSL. (If the business later needs non-dev authoring, every transition is kept small and pure so it *could* be lowered to a serializable form — but we build none of that now.)
- No-code visual editor.
- XState / full state-machine framework. The history-stack engine already in place is sufficient.

---

## 2. Background: what already exists (verified against code)

The engine is already config-driven. Confirmed in code on 2026-06-19:

- **`FunnelSpec`** (`types.ts:207-218`): `slug`, `offer`, `title`, `hero`, `theme`, `pixel`, `landing?.blocks[]`, `steps[]`, and an **already-defined but unused** `flow?: (answers, currentStepId) => StepId | null`.
- **Two registries**: `MARKETING_REGISTRY` (`constants/marketing-registry.ts`) and `STEP_REGISTRY` (`constants/step-registry.ts`), each a typed `kind → component` map backed by discriminated unions (`MarketingBlock`, `FunnelStep` in `types.ts`).
- **Shared step defaults** exported and composed via spread+override: `ZIP_STEP`, `PII_STEP`, `ADDRESS_STEP`, `CONFIRMATION_STEP` (e.g. `{ ...ZIP_STEP, content: {…} }` in `kitchens.ts`).
- **Engine** (`hooks/use-funnel-engine.ts`): history-stack state (`currentStepId`, `history[]`, `answers`), localStorage persistence (`funnel:${slug}`), `advance()`/`back()`/`reset()`. `advance()` currently computes the next id via `spec.flow` else `defaultLinearNext()`.
- **Routing**: `/funnels/[trade]` → `getFunnel(slug)` (`lib/registry.ts`) → `<FunnelEngine>`. `bathrooms` and `complete-interior` are stubs.
- **Assets**: `public/funnels/common/` (shared) vs `public/funnels/<slug>/` (trade-specific) already in use.

### The three real gaps
1. **No ad-hoc injection.** Both registries are *closed* — a one-off custom block/step forces edits to global `types.ts` unions + the registry.
2. **Shared blocks aren't customizable per funnel.** `reviews` / `testimonials` ignore per-funnel content and hard-wire to global company constants.
3. **Branching/disqualification is unbuilt.** `flow` is unused, monolithic per funnel, and has no first-class disqualification concept.

> ⚠️ **Stale-ref note:** `memory/feedback-funnel-design-standards.md` and the entity-model memory describe funnels at a more primitive stage than the code. Refresh as part of Phase 3 (non-blocking).

---

## 3. Core principle: three tiers, applied to both blocks and steps

| Tier | Blocks | Steps | Mechanism |
|---|---|---|---|
| **1 — Shared static** | `licensing`, `reviews` (from company constants) | `PII_STEP`, `ADDRESS_STEP` used as-is | Registry entry, zero per-funnel config |
| **2 — Shared customizable** | `testimonials`, `problem`, `value`, `process`, `faq`, `callout`, `cta`, `guarantee`, `portfolio` | `configureStep(ZIP_STEP, { content })` | Registry entry + per-funnel override, defaulting to globals |
| **3 — Custom one-off** | funnel-unique block (e.g. `roi-calculator`) | funnel-unique question step | **`defineBlock` / `defineStep` inline — no global edits** |

The architectural unlock is **Tier 3**: an *open* escape hatch layered on top of the existing *closed, typed* registries. Shared blocks/steps stay fully type-checked through the registry; custom ones carry their own component inline and never pollute the global surface.

---

## 4. Block system (gaps #1 and #2)

### 4.1 Tier-3 injection — `defineBlock`

New helper `lib/define-block.ts`:

```ts
export interface CustomBlock<P = unknown> {
  kind: 'custom'
  id: string                                   // stable key for React + analytics
  content: P
  component: FC<{ content: P; ctx: FunnelContext }>
  schema?: z.ZodType<P>                         // optional runtime guard
}

export function defineBlock<P>(def: {
  id: string
  schema?: z.ZodType<P>
  component: FC<{ content: P; ctx: FunnelContext }>
  content: P
}): CustomBlock<P>
```

- `MarketingBlock` union gains one arm: `| CustomBlock`.
- **Render dispatch** (`funnel-landing.tsx`): *if `block.kind === 'custom'`, render `block.component`; else look up `MARKETING_REGISTRY[block.kind]`.* Shared blocks (Tiers 1–2) untouched.
- The custom block's content type is preserved at the authoring site by the generic helper; it is **not** added to any keyed map.

### 4.2 Tier-2 fix — shared blocks honor per-funnel overrides

`reviews-block.tsx` and `testimonials-block.tsx` change to `content.items ?? globalDefault` (and equivalent for rating/label), so per-funnel content actually wins while still defaulting to company constants. This is the existing **defaults-with-override** convention (`memory/feedback-defaults-with-override.md`). No type changes needed — `TestimonialsBlockContent.items` is already optional.

---

## 5. Step system (mirrors blocks)

### 5.1 Tier-3 injection — `defineStep`

New helper `lib/define-step.ts`:

```ts
export interface CustomStep<C = unknown, A = unknown> {
  kind: 'custom'
  id: StepId
  content: C
  component: StepComponentForCustom<C, A>      // receives the uniform StepProps shape
  answerSchema?: z.ZodType<A>
  next?: (answers: FunnelAnswers) => StepOutcome   // §6
}

export function defineStep<C, A>(def: { … }): CustomStep<C, A>
```

- `FunnelStep` union gains one arm: `| CustomStep`.
- Custom step content/answer types live **on the variant** (carried by the generic helper), **not** via `ContentByKind` / `AnswerByKind`. The engine reads/writes its answer through the same `answers[step.id]` slot.
- **Render dispatch** (`step-registry.ts` lookup site): *if `step.kind === 'custom'`, render `step.component`; else `STEP_REGISTRY[step.kind]`.*

### 5.2 Tier-2 helper — `configureStep`

`lib/configure-step.ts` provides a type-safe deep-merge for the common spread+override pattern, plus the optional `next` rule:

```ts
const ownership = configureStep(OWNERSHIP_STEP, {
  content: { subtitle: 'Kitchens only' },
  next: (a) => …,   // §6
})
```

Replaces hand-spreading nested `content` and is the canonical way to attach a transition to a shared step.

---

## 6. Branching & disqualification engine (gap #3)

### 6.1 Per-step transitions

Every step may carry `next?: (answers) => StepOutcome`. The engine evaluates **the current step's** `next` at the single `advance()` chokepoint; absent a `next`, it falls back to today's `defaultLinearNext()` (linear-by-index). The step array stays **static** — branching chooses a path through it; "optional" steps simply aren't targeted on the default path. (No array mutation → no index-drift bugs; multi-level back across branches stays correct via the existing history stack.)

`spec.flow` is retained for back-compat but **per-step `next` takes precedence**; per-step is the documented norm. (`kitchens` uses neither today, so no migration risk.)

### 6.2 The outcome model

New `lib/outcomes.ts`:

```ts
export type DqBehavior =
  | { type: 'stop' }                         // dead-end screen only
  | { type: 'capture-stop' }                 // submit lead flagged disqualified, then dead-end screen
  | { type: 'soft-route'; to: StepId }       // continue to a designated alt step/offer

export type StepOutcome =
  | { type: 'go'; to: StepId }
  | { type: 'done' }
  | { type: 'disqualify'; reason: string; behavior: DqBehavior }

export const go = (to: StepId): StepOutcome => ({ type: 'go', to })
export const done = (): StepOutcome => ({ type: 'done' })
export const disqualify = (reason: string, behavior: DqBehavior): StepOutcome =>
  ({ type: 'disqualify', reason, behavior })
```

Authoring example (renter → owner-only, capture the lead then stop):

```ts
const ownership = configureStep(OWNERSHIP_STEP, {
  next: (a) => a.ownership === 'rent'
    ? disqualify('owner-only', { type: 'capture-stop' })
    : go('location'),
})
```

### 6.3 Engine changes (`use-funnel-engine.ts`)

`advance()` interprets the outcome:
- `go(to)` → push current to history, set `currentStepId = to`.
- `done()` → terminal; no advance.
- `disqualify(reason, behavior)`:
  - `stop` → route to the `disqualified` step (no capture).
  - `capture-stop` → fire DQ-tagged lead capture (§6.5), then route to `disqualified`.
  - `soft-route(to)` → route to `to` (no dead-end), still tag the lead/answer with the DQ reason for analytics.
- `hasNext` derivation updates to interpret outcomes (DQ/done ⇒ no generic "next").

### 6.4 Disqualified screen

New step kind `disqualified` + view `ui/steps/disqualified-step.tsx`, terminal, mirroring `confirmation`'s structure. Content: `{ reason?, headline, body, … }`. Registered in `STEP_REGISTRY` (it is a *shared* step, not a custom one). The DQ reason can select messaging.

### 6.5 Lead capture & pixel on DQ

> **Refined during planning (2026-06-19) — these are DEFERRED, not built in Phase 2:**
> - **Disqualification is stubbed, not active.** The business has not committed to disqualifying leads, so Phase 2 builds only the inert model + a minimal dead-end screen. No funnel wires a DQ rule.
> - **No pixel fires today** (verified: `FunnelPixel.contentCategory` is declared but never used). Building the base Meta pixel pipeline is its own **Phase 2.5**.
> - **Pre-PII timing gap:** the canonical renter DQ fires at the ownership step (step 2), *before* the PII step (step 4) creates the lead — so there is no contact info to capture at that point. Activating capture must handle anonymous pre-PII DQ events vs. post-PII lead flagging. Deferred to a future "activate disqualification" phase.

The target design (when activated) remains:
- `capture-stop` reuses the existing confirmation submit/enrichment path, tagging the lead `disqualified: true` + `reason`, so **DQ rate is measurable per UTM source**.
- A **distinct pixel event** fires for DQ vs. qualified, so Meta optimization is not trained on dead-end "conversions".

---

## 7. Documentation deliverable

First-class output: **`src/shared/domains/funnels/DOCS.md`** (slug-anchored, per the codebase convention), with in-code `// see ./DOCS.md#slug` refs from the engine, registries, and `define*`/`configure*` helpers. Sections:

1. **Core model** — funnel = trade + offer; the `FunnelSpec` contract.
2. **Cross-funnel invariants** — what *every* funnel must have: a hero; a PII step; a ZIP/service-area gate; an address step; a terminal confirmation; the pixel events that must fire; the `funnel:${slug}` persistence key shape.
3. **Business rules & logic** — owner-only (renter DQ); service-area gating; the per-rule DQ behaviors and when to use each; lead-capture-on-DQ rule; qualified-vs-DQ pixel split.
4. **The three block tiers** — when to use each + how to add one (incl. the `defineBlock` recipe and the Tier-2 override convention).
5. **The three step tiers** — same, with `defineStep` / `configureStep`.
6. **Branching model** — `StepOutcome`, the `advance()` chokepoint, authoring transitions, how to test them.
7. **"Instantiate a new funnel" recipe** — canonical end-to-end checklist: new spec file → register slug (`slugs.ts`) → trade mapping (`trade-by-slug.ts`) → assets (`public/funnels/<slug>/`) → compose blocks/steps → wire branching → verify invariants → `pnpm tsc && pnpm lint`.

Also: refresh `memory/feedback-funnel-design-standards.md` and add a one-line `MEMORY.md` pointer to the new `DOCS.md`.

---

## 8. File plan

**New** (under `src/shared/domains/funnels/`):
- `lib/define-block.ts`, `lib/define-step.ts`, `lib/configure-step.ts`
- `lib/outcomes.ts` (`go` / `done` / `disqualify` + `StepOutcome` / `DqBehavior`)
- `ui/steps/disqualified-step.tsx`
- `DOCS.md`

**Touched:**
- `types.ts` — add `CustomBlock` / `CustomStep` union arms; add `next?: (answers) => StepOutcome` to step config; add `disqualified` step kind + content (in `ContentByKind`/`AnswerByKind` since it is a shared kind).
- `ui/funnel-landing.tsx` + `constants/step-registry.ts` lookup site — "inline component wins" branch.
- `hooks/use-funnel-engine.ts` — evaluate per-step `next` at `advance()`; interpret outcomes; route DQ; fire DQ-tagged capture + distinct pixel event; update `hasNext`.
- `ui/blocks/reviews-block.tsx`, `ui/blocks/testimonials-block.tsx` — honor per-funnel overrides.
- `constants/kitchens.ts` — first real consumer of the renter DQ rule (Phase 2 proof).
- `memory/MEMORY.md`, `memory/feedback-funnel-design-standards.md` — refresh.

---

## 9. Phasing (each independently shippable)

- **Phase 1 — Reusability core**: `defineBlock` / `defineStep` / `configureStep` + inline-component rendering + Tier-2 override fix (`reviews` only — `testimonials` already compliant). Unlocks custom one-offs and true shared-customization. **No behavior change to kitchens.** → `docs/superpowers/plans/2026-06-19-funnel-engine-phase1-reusability.md`
- **Phase 2 — Branching engine**: `outcomes.ts`, per-step `next` in engine, `resolveNext`/`outcomeTargetId`, **disqualified stub screen (inert — no capture, no pixel, no funnel wires a DQ rule)**. Branching proven via a temporary conditional-skip in kitchens (reverted). → `docs/superpowers/plans/2026-06-19-funnel-engine-phase2-branching.md`
- **Phase 2.5 — Pixel pipeline (future)**: build the base Meta pixel firing (qualified `Lead` event + distinct DQ event). Not yet planned; write when ready.
- **Phase 3 — Docs**: author `DOCS.md` end-to-end, add in-code refs, refresh memory. → `docs/superpowers/plans/2026-06-19-funnel-engine-phase3-docs.md`
- **Future — Activate disqualification**: wire a real DQ rule + lead-capture-on-DQ (anonymous pre-PII event + post-PII flag). Gated on a business decision to disqualify leads.

**Verification per phase:** `pnpm tsc` + `pnpm lint` (no unit-test runner in repo — the compiler is the primary test surface) + manual/Playwright-MCP browser smoke; kitchens renders unchanged after Phases 1 and 2.

---

## 10. Decisions captured (from brainstorming)

1. **Authoring model:** developers, in TypeScript. No serializable/CMS layer.
2. **Logic model:** per-step transition functions (not a centralized `flow`, not declarative rule objects).
3. **Disqualification:** per-rule behavior — `stop` | `capture-stop` | `soft-route`.
4. **Scope:** all three gaps in one phased spec + a first-class documentation deliverable.
