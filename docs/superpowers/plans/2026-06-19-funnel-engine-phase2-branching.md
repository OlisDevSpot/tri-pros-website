# Funnel Engine — Phase 2: Branching Engine (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-step conditional transitions to the funnel engine — each step may declare `next(answers) => StepOutcome` to skip/insert/branch — with a complete `go | done | disqualify` outcome model. Disqualification is built as an inert **stub** (model + minimal dead-end screen, no lead capture, no pixel, not wired into any funnel).

**Architecture:** Introduce a small `StepOutcome` algebra (`lib/outcomes.ts`) and a single resolver (`resolveNext`) that the engine consults at its one `advance()` chokepoint. Precedence: a step's own `next` → the legacy `spec.flow` (back-compat) → linear-by-index. The full `steps` array stays static; branching only *chooses a path* through it (no array mutation → history-stack back/forward stays correct). Disqualification routes to a `disqualified` step kind but performs no capture/pixel (Phase 2.5 / a future "activate DQ" phase will wire those).

**Tech Stack:** Next.js 15, React 19, TypeScript (strict), `motion/react`, Tailwind v4. `@/` → `src/`. pnpm.

**Source spec:** `docs/superpowers/specs/2026-06-19-headless-funnel-engine-design.md` (§6). **Depends on:** Phase 1 (`defineStep`/`configureStep`/`CustomStep` must exist).

## Global Constraints

- **Verification = `pnpm tsc` + `pnpm lint`** + manual browser smoke (no unit-test runner in repo; the compiler is the primary test surface). NEVER `pnpm build`.
- **Work on `main`.** Stage only the files each task names — never `git add -A` (unrelated funnel WIP + staged asset renames must not be swept in).
- **Coding conventions:** one component per file; named exports only; no file-level constants/helpers in component files (→ `constants/`/`lib/`); no barrels in `lib/`/`constants/`/`ui/`; sorted imports; braced `if` bodies + newline.
- **Disqualification stays inert.** Phase 2 must NOT add lead capture, pixel firing, or any real DQ rule to a production funnel. The renter rule is shown only as a temporary, reverted proof (Task 7).
- **No behavior change to kitchens** after Phase 2 (the branching proof in Task 7 is reverted).

---

## File Structure

**New files (under `src/shared/domains/funnels/`):**
- `lib/outcomes.ts` — `StepOutcome`, `DqBehavior` types + `go()`/`done()`/`disqualify()` constructors.
- `ui/steps/disqualified-step.tsx` — minimal terminal dead-end screen (stub).

**Modified files:**
- `types.ts` — add `next?` to `BaseStep`; add `DisqualifiedStep` variant + `disqualified` entries in `ContentByKind`/`AnswerByKind`.
- `lib/funnel-flow.ts` — add `resolveNext(spec, step, answers) => StepOutcome` + `outcomeTargetId(spec, outcome) => StepId | null` (keep `defaultLinearNext`).
- `lib/define-step.ts` — add optional `next` to `CustomStep` + `defineStep` (extends Phase 1).
- `lib/configure-step.ts` — add optional `next` to the overrides param (extends Phase 1).
- `hooks/use-funnel-engine.ts` — `advance()` + `hasNext` use `resolveNext`/`outcomeTargetId`.
- `constants/step-registry.ts` — register `disqualified` → `DisqualifiedStepView`.

**Why these boundaries:** the outcome algebra is pure data + constructors (its own file, no React). The resolver lives beside the existing `defaultLinearNext` it supersedes. The engine change is confined to the two places that compute "where next". The DQ screen is one focused component.

---

## Task 1: Outcome model (`lib/outcomes.ts`)

**Files:**
- Create: `src/shared/domains/funnels/lib/outcomes.ts`

**Interfaces:**
- Produces: `StepOutcome`, `DqBehavior` types; `go(to)`, `done()`, `disqualify(reason, behavior)` constructors. Consumed by Tasks 2-6.

- [ ] **Step 1: Create the file**

```ts
import type { StepId } from '@/shared/domains/funnels/types'

/**
 * What happens to a disqualified user. STUB in Phase 2 — `capture-stop` performs
 * no capture and no pixel yet; both are deferred (Phase 2.5 pixel + a future
 * "activate DQ" phase). `soft-route` carries its own destination.
 * see ../DOCS.md#branching (added in Phase 3)
 */
export type DqBehavior
  = | { type: 'stop' }
    | { type: 'capture-stop' }
    | { type: 'soft-route', to: StepId }

/** The result of a step's `next(answers)` transition. */
export type StepOutcome
  = | { type: 'go', to: StepId }
    | { type: 'done' }
    | { type: 'disqualify', reason: string, behavior: DqBehavior }

export function go(to: StepId): StepOutcome {
  return { type: 'go', to }
}

export function done(): StepOutcome {
  return { type: 'done' }
}

export function disqualify(reason: string, behavior: DqBehavior): StepOutcome {
  return { type: 'disqualify', reason, behavior }
}
```

- [ ] **Step 2: Verify + lint**

Run: `pnpm tsc` → Expected: PASS.
Run: `pnpm lint` → Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/funnels/lib/outcomes.ts
git commit -m "feat(funnel): StepOutcome model + go/done/disqualify constructors

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `next?` on every step + `disqualified` step kind

**Files:**
- Modify: `src/shared/domains/funnels/types.ts`

**Interfaces:**
- Consumes: `StepOutcome` (Task 1), `FunnelAnswers`.
- Produces: every step may carry `next?: (answers: FunnelAnswers) => StepOutcome`; new `DisqualifiedStep` variant (`kind: 'disqualified'`, content `DisqualifiedContent`, answer `never`). Consumed by Tasks 3-6.

- [ ] **Step 1: Import the outcome type**

At the top of `src/shared/domains/funnels/types.ts`, add:

```ts
import type { StepOutcome } from '@/shared/domains/funnels/lib/outcomes'
```

- [ ] **Step 2: Add `next?` to `BaseStep`**

Change `BaseStep` (line 102) so all registry-step variants inherit the optional transition:

```ts
interface BaseStep<K extends string> {
  id: StepId
  kind: K
  /** Optional per-step transition. Absent = linear. see ./lib/outcomes.ts */
  next?: (answers: FunnelAnswers) => StepOutcome
}
```

- [ ] **Step 3: Add the `disqualified` content + answer + variant**

Add a content interface near the other content types (after `ConfirmationContent`, ~line 88):

```ts
export interface DisqualifiedContent {
  headline: string
  body: string
  /** Optional machine reason for analytics/messaging selection. */
  reason?: string
}
```

Add to `AnswerByKind` (line 18-24) and `ContentByKind` (line 91-97):

```ts
// in AnswerByKind:
  'disqualified': never
// in ContentByKind:
  'disqualified': DisqualifiedContent
```

Add the variant and extend the union (after `PiiStep`, ~line 107-109):

```ts
export interface DisqualifiedStep extends BaseStep<'disqualified'> { content: DisqualifiedContent }

export type FunnelStep = AddressStep | CardSelectStep | ConfirmationStep | LocationStep | PiiStep | DisqualifiedStep | CustomStep
```

- [ ] **Step 4: Verify + lint**

Run: `pnpm tsc`
Expected: PASS — but the `StepRegistry` mapped type (`RegistryStepKind` from Phase 1) now includes `'disqualified'`, so `STEP_REGISTRY` will error until Task 5 adds its entry. **If tsc reports only the missing `disqualified` registry key, that is expected** — it is fixed in Task 5. Resolve all other errors here.
Run: `pnpm lint` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/domains/funnels/types.ts
git commit -m "feat(funnel): per-step next transition + disqualified step kind

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Resolver (`resolveNext` + `outcomeTargetId`)

**Files:**
- Modify: `src/shared/domains/funnels/lib/funnel-flow.ts`

**Interfaces:**
- Consumes: `FunnelSpec`, `FunnelStep`, `FunnelAnswers`, `StepId`, `StepOutcome` (Task 1).
- Produces:
  - `resolveNext(spec: FunnelSpec, step: FunnelStep, answers: FunnelAnswers) => StepOutcome`
  - `outcomeTargetId(spec: FunnelSpec, outcome: StepOutcome) => StepId | null`
  Consumed by Task 4 (engine).

- [ ] **Step 1: Add the resolver functions**

Append to `src/shared/domains/funnels/lib/funnel-flow.ts` (keep `defaultLinearNext`):

```ts
import type { FunnelAnswers, FunnelSpec } from '@/shared/domains/funnels/types'
import type { StepOutcome } from '@/shared/domains/funnels/lib/outcomes'

/**
 * Resolve a step's outcome. Precedence: the step's own `next` → the legacy
 * spec-level `flow` (wrapped as go/done) → linear-by-index. The single source of
 * truth the engine consults at its `advance()` chokepoint. see ../DOCS.md#branching
 */
export function resolveNext(spec: FunnelSpec, step: FunnelStep, answers: FunnelAnswers): StepOutcome {
  if (step.next) {
    return step.next(answers)
  }
  if (spec.flow) {
    const id = spec.flow(answers, step.id)
    return id ? { type: 'go', to: id } : { type: 'done' }
  }
  const id = defaultLinearNext(spec.steps, step.id)
  return id ? { type: 'go', to: id } : { type: 'done' }
}

/**
 * The concrete step id an outcome navigates to, or null when terminal.
 * `disqualify` routes to the spec's `disqualified` step (stub — capture/pixel are
 * future work); `soft-route` carries its own target. A `stop`/`capture-stop` with
 * no `disqualified` step present yields null (no-op advance) — acceptable while DQ
 * is inert and unwired.
 */
export function outcomeTargetId(spec: FunnelSpec, outcome: StepOutcome): StepId | null {
  if (outcome.type === 'go') {
    return outcome.to
  }
  if (outcome.type === 'done') {
    return null
  }
  // disqualify
  if (outcome.behavior.type === 'soft-route') {
    return outcome.behavior.to
  }
  const dq = spec.steps.find(s => s.kind === 'disqualified')
  return dq ? dq.id : null
}
```

Note: `funnel-flow.ts` currently imports only `FunnelStep`, `StepId`. Add `FunnelAnswers`, `FunnelSpec` to that import (keep imports sorted).

- [ ] **Step 2: Verify + lint**

Run: `pnpm tsc` → Expected: PASS (the `disqualified` registry error from Task 2 may still show until Task 5 — ignore only that one).
Run: `pnpm lint` → Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/funnels/lib/funnel-flow.ts
git commit -m "feat(funnel): resolveNext + outcomeTargetId branching resolver

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Engine consumes the resolver

**Files:**
- Modify: `src/shared/domains/funnels/hooks/use-funnel-engine.ts` (`advance` ~lines 54-64; `hasNext` ~lines 79-82)

**Interfaces:**
- Consumes: `resolveNext`, `outcomeTargetId` (Task 3).
- Produces: engine `advance()` routes via outcomes; `hasNext` reflects the resolved outcome. No API surface change to `FunnelEngineApi`.

- [ ] **Step 1: Swap the imports**

In `src/shared/domains/funnels/hooks/use-funnel-engine.ts`, replace the `defaultLinearNext` import (line 4) with:

```ts
import { outcomeTargetId, resolveNext } from '@/shared/domains/funnels/lib/funnel-flow'
```

- [ ] **Step 2: Rewrite `advance()`**

Replace the `advance` callback (lines 54-64) with:

```ts
  const advance = useCallback(() => {
    setState((prev) => {
      const cur = spec.steps.find(s => s.id === prev.currentStepId) ?? spec.steps[0]
      const outcome = resolveNext(spec, cur, prev.answers)
      const nextId = outcomeTargetId(spec, outcome)
      if (!nextId || nextId === prev.currentStepId) {
        return prev
      }
      return { ...prev, currentStepId: nextId, history: [...prev.history, prev.currentStepId] }
    })
  }, [spec, setState])
```

- [ ] **Step 3: Rewrite the `hasNext` derivation**

Replace lines 79-82 with:

```ts
  const outcome = resolveNext(spec, step, effective.answers)
  const hasNext = (outcome.type === 'go' && outcome.to !== step.id) || outcome.type === 'disqualify'
```

(`disqualify` counts as "has a next screen" so the Next/advance affordance shows when a DQ rule is wired; while DQ is inert no funnel produces this outcome.)

- [ ] **Step 4: Verify + lint**

Run: `pnpm tsc` → Expected: PASS (excluding only the known Task-2 `disqualified` registry gap, resolved in Task 5).
Run: `pnpm lint` → Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/domains/funnels/hooks/use-funnel-engine.ts
git commit -m "feat(funnel): engine routes via resolveNext/outcomeTargetId

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Disqualified stub screen + registry entry

**Files:**
- Create: `src/shared/domains/funnels/ui/steps/disqualified-step.tsx`
- Modify: `src/shared/domains/funnels/constants/step-registry.ts`

**Interfaces:**
- Consumes: `StepProps`, `DisqualifiedStep` (Task 2).
- Produces: `DisqualifiedStepView` registered at `STEP_REGISTRY.disqualified`; exported `DISQUALIFIED_STEP` default for future authoring.

- [ ] **Step 1: Create the stub view**

```tsx
import type { DisqualifiedStep, StepProps } from '@/shared/domains/funnels/types'

/**
 * Terminal dead-end screen for a disqualified user. STUB (Phase 2): purely
 * presentational — no lead capture, no pixel. Not wired into any production
 * funnel yet. see ../../DOCS.md#branching
 */
export function DisqualifiedStepView({ content }: StepProps<DisqualifiedStep>) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
      <h1 className="text-foreground text-2xl font-semibold">{content.headline}</h1>
      <p className="text-muted-foreground max-w-md">{content.body}</p>
    </section>
  )
}

/** Reusable default for funnels that opt into disqualification (none yet). */
export const DISQUALIFIED_STEP: DisqualifiedStep = {
  id: 'disqualified',
  kind: 'disqualified',
  content: {
    headline: 'Thanks for your interest',
    body: 'Based on your answers, we’re not able to help with this project right now.',
  },
}
```

- [ ] **Step 2: Register it**

In `src/shared/domains/funnels/constants/step-registry.ts`, add the import (sorted) and the entry:

```ts
import { DisqualifiedStepView } from '@/shared/domains/funnels/ui/steps/disqualified-step'
// …
export const STEP_REGISTRY: StepRegistry = {
  'address': AddressStepView,
  'card-select': CardSelectStepView,
  'confirmation': ConfirmationStepView,
  'disqualified': DisqualifiedStepView,
  'location': LocationStepView,
  'pii-form': PiiFormStepView,
}
```

- [ ] **Step 3: Verify + lint**

Run: `pnpm tsc` → Expected: PASS (the Task-2 registry gap is now closed; full project type-checks).
Run: `pnpm lint` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/funnels/ui/steps/disqualified-step.tsx src/shared/domains/funnels/constants/step-registry.ts
git commit -m "feat(funnel): disqualified stub screen + registry entry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Add `next` to `defineStep` and `configureStep`

**Files:**
- Modify: `src/shared/domains/funnels/lib/define-step.ts`
- Modify: `src/shared/domains/funnels/lib/configure-step.ts`

**Interfaces:**
- Consumes: `StepOutcome` (Task 1), `FunnelAnswers`.
- Produces: `defineStep`/`CustomStep` and `configureStep` overrides accept an optional `next` transition.

- [ ] **Step 1: Extend `CustomStep` + `defineStep`**

In `src/shared/domains/funnels/lib/define-step.ts`, import the types and add `next?` to both the interface and the helper param:

```ts
import type { FunnelAnswers, StepId, StepProps } from '@/shared/domains/funnels/types'
import type { StepOutcome } from '@/shared/domains/funnels/lib/outcomes'

export interface CustomStep<C = unknown, A = unknown> {
  kind: 'custom'
  id: StepId
  content: C
  component: ComponentType<StepProps<CustomStep<C, A>>>
  answerSchema?: z.ZodType<A>
  next?: (answers: FunnelAnswers) => StepOutcome
}

export function defineStep<C, A>(def: {
  id: StepId
  content: C
  component: ComponentType<StepProps<CustomStep<C, A>>>
  answerSchema?: z.ZodType<A>
  next?: (answers: FunnelAnswers) => StepOutcome
}): CustomStep<C, A> {
  return { kind: 'custom', ...def }
}
```

- [ ] **Step 2: Extend `configureStep` overrides**

In `src/shared/domains/funnels/lib/configure-step.ts`, add `next` to the overrides param and carry it through:

```ts
import type { ContentOf, FunnelAnswers, FunnelStep } from '@/shared/domains/funnels/types'
import type { StepOutcome } from '@/shared/domains/funnels/lib/outcomes'

export function configureStep<S extends FunnelStep>(
  base: S,
  overrides: { content?: Partial<ContentOf<S>>, next?: (answers: FunnelAnswers) => StepOutcome },
): S {
  const content = overrides.content ? { ...base.content, ...overrides.content } : base.content
  return { ...base, content, next: overrides.next ?? base.next }
}
```

- [ ] **Step 3: Verify + lint**

Run: `pnpm tsc` → Expected: PASS.
Run: `pnpm lint` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/funnels/lib/define-step.ts src/shared/domains/funnels/lib/configure-step.ts
git commit -m "feat(funnel): defineStep/configureStep accept a next transition

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Branching proof (temporary, reverted)

**Files:**
- Temporarily modify: `src/shared/domains/funnels/constants/kitchens.ts`

**Interfaces:**
- Consumes: `configureStep` + `next` (Task 6), the engine resolver (Task 4).
- Produces: nothing permanent — proves a conditional skip works end-to-end, then reverts (per the no-behavior-change constraint).

- [ ] **Step 1: Add a temporary conditional skip**

In `src/shared/domains/funnels/constants/kitchens.ts`, wrap one mid-funnel card-select step with a `next` that conditionally skips the following step (choose two adjacent step ids that exist in the kitchens `steps` array — e.g. make `scope` skip `timeline` and go straight to `address` when `scope === 'small'`). Use `configureStep` + `go`:

```ts
import { go } from '@/shared/domains/funnels/lib/outcomes'
// wrap the existing `scope` step object:
configureStep(SCOPE_STEP_OBJECT, {
  next: a => a.scope === 'small' ? go('address') : go('timeline'),
}),
```

(Adapt to the actual inline step variable/ids in the file. The point is: one step gets a `next` that branches on its answer.)

- [ ] **Step 2: Verify compile + behavior**

Run: `pnpm tsc` → Expected: PASS.
Run: `pnpm dev`, load `/funnels/kitchens`, answer through to the wrapped step. Pick the branching answer and confirm the engine skips the intended step; pick another answer and confirm it does NOT skip. Use Back and confirm history returns correctly across the branch. (Drive via Playwright MCP if preferred.)
Expected: conditional skip works both ways; Back is correct.

- [ ] **Step 3: Revert the proof**

Remove the `configureStep(...)`/`go` wrapping and import from `kitchens.ts`.

Run: `git diff src/shared/domains/funnels/constants/kitchens.ts`
Expected: empty diff.

- [ ] **Step 4: Full-phase verification**

Run: `pnpm tsc` → Expected: PASS.
Run: `pnpm lint` → Expected: PASS.
Run: `pnpm dev`, walk the kitchens funnel end to end.
Expected: identical to pre-Phase-2 behavior; no console errors.

- [ ] **Step 5: No commit** (proof reverted; Tasks 1-6 are the deliverable).

---

## Self-Review (against the spec)

**Spec coverage (§6):**
- §6.1 per-step transitions + precedence (step `next` → `flow` → linear) → Tasks 2, 3, 4. ✓
- §6.2 outcome model (`go`/`done`/`disqualify` + `DqBehavior`) → Task 1. ✓
- §6.3 engine interprets outcomes at the single chokepoint → Task 4. ✓
- §6.4 disqualified screen → Task 5 (stub, per the "don't commit to DQ yet" decision). ✓
- §6.5 lead capture + pixel on DQ → **intentionally deferred** (capture: future "activate DQ" phase; pixel: Phase 2.5) per user decision. The model supports it (`capture-stop`) but it is inert. ✓
- Branching authoring via `defineStep`/`configureStep` `next` → Task 6. ✓

**Placeholder scan:** No TBD/TODO; all code shown in full; the only temporary code (Task 7) is created-verified-reverted with an explicit empty-diff check.

**Type consistency:** `StepOutcome`/`DqBehavior` and `go`/`done`/`disqualify` are used identically across Tasks 1-7. `resolveNext`/`outcomeTargetId` signatures match between Task 3 (definition) and Task 4 (consumption). `disqualified` literal is consistent across `types.ts`, the resolver, the step view, and the registry. `next?` signature `(answers: FunnelAnswers) => StepOutcome` is identical on `BaseStep`, `CustomStep`, and the `configureStep` overrides.

**Known limitation (documented in Phase 3):** the progress bar denominator stays `spec.steps.length` regardless of the branched path. Acceptable while branches aren't wired into production; a path-aware progress count is out of scope.

**Deferred to future plans:** Phase 2.5 (base Meta pixel pipeline: qualified `Lead` event + distinct DQ event) and an "activate disqualification" phase (lead-capture-on-DQ: anonymous pre-PII DQ event + post-PII lead flagging) — to be written when the business commits to disqualifying leads.
