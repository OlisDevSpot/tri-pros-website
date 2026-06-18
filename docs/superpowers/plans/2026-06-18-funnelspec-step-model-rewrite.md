# FunnelSpec & Step-Model Type-Layer Rewrite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the funnels engine type layer to the hardened model — per-kind content/answer types, composite-ready answers with one typed `setValue`, and a uniform `ctx`-carrying `StepProps` — keeping the landed discriminated-union + mapped-registry plumbing, for the two kinds implemented today (`info`, `card-select`).

**Architecture:** `FunnelStep` stays a discriminated union dispatched through the mapped `StepRegistry`. Content and answer shapes are correlated to each kind via `ContentByKind`/`AnswerByKind` lookup interfaces (no shared kitchen-sink `StepContent`). Every step receives identical `StepProps` including a funnel-level `ctx` ({slug, offer, theme, utm}), so future composite/lead steps need no engine special-casing. Answers are one typed slot per step id; the single `setValue` channel replaces `onChange`/`setAnswers`. Specs are plain `as const satisfies` literals — no factory.

**Tech Stack:** Next.js 15.5.9, React 19, TypeScript (strict), `motion` v12, `usePersistedState` (localStorage), `@/`→`src/`.

**Spec:** `docs/superpowers/specs/2026-06-18-funnelspec-step-model-design.md`. Supersedes Seam C / reshapes Seam A of `docs/superpowers/specs/2026-06-18-funnels-headless-step-library-design.md`.

## Global Constraints

- **No test runner.** Verification = `pnpm tsc` + `pnpm lint` (+ `pnpm lint:fix` to auto-sort imports) + a final runtime browser smoke. NEVER run `pnpm build`.
- **Work on `main`. Pathspec-only commits:** `git status --short` first, then `git commit -- <exact paths>`. Never `git add -A` / bare `git commit`.
- Named exports only (never `export default`, except Next.js `page.tsx`). `import type` at top level (no inline `type` specifiers). Braces + newline on every `if`. Imports sorted (perfectionist) — run `pnpm lint:fix` to satisfy.
- One React component per file. No barrels in `ui/`/`constants/`/`lib/`/`hooks/`. `shared/` never imports from `features/`. `schemas/` is a sibling of `lib/`. Constants/config objects live in `constants/`, pure fns in `lib/`.
- Motion respects `prefers-reduced-motion` (already wired via `useReducedMotion`).
- Engine stays trade-agnostic: trade/offer data flows only via the spec + `ctx` + answers.
- **Scope:** only `info` + `card-select` kinds are implemented here. `location`/`pii-form`/`datetime`/`confirmation` are added later (Plan 2b/2c) by extending `FunnelStep` + `AnswerByKind` + `ContentByKind` + `STEP_REGISTRY` in lockstep — `tsc` forces all four. Do NOT add those kinds in this plan.
- **Refactor sequencing:** this is a tightly-coupled type-layer rewrite. Tasks 2–5 intentionally leave `tsc` with residual errors in not-yet-updated consumers (each task documents which). The tree is fully green only at the end of Task 6; Task 7 is the runtime gate. Commit each task as a checkpoint regardless (SDD reviews per task).

---

### Task 1: `useFunnelUtm` hook + UTM storage key (foundation for `ctx`)

`ctx` carries captured UTM, so the `FunnelUtm` type + its hook must exist before `types.ts` references it. This task is standalone and `tsc`-clean on its own.

**Files:**
- Modify: `src/shared/domains/funnels/constants/storage-keys.ts`
- Create: `src/shared/domains/funnels/hooks/use-funnel-utm.ts`

**Interfaces:**
- Produces: `funnelUtmKey(slug): string`; `FunnelUtm` (7 nullable string fields); `EMPTY_UTM: FunnelUtm`; `useFunnelUtm(slug): FunnelUtm` — captures `utm_*`/`fbclid`/`gclid` from the URL once on mount, persists per funnel, returns the captured object.

- [ ] **Step 1: Add the UTM key builder** to `constants/storage-keys.ts` (append below the existing `funnelStateKey`):

```ts
/** localStorage key for a funnel's captured UTM attribution. */
export function funnelUtmKey(slug: FunnelSlug): string {
  return `${STORAGE_KEY_PREFIX}funnel-utm:${slug}`
}
```

(`STORAGE_KEY_PREFIX` and `FunnelSlug` are already imported in that file from the 2a cleanup. Verify with `Read` before editing.)

- [ ] **Step 2: Create the hook** `hooks/use-funnel-utm.ts`:

```ts
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import { useEffect } from 'react'
import { funnelUtmKey } from '@/shared/domains/funnels/constants/storage-keys'
import { usePersistedState } from '@/shared/hooks/use-persisted-state'

export interface FunnelUtm {
  source: string | null
  medium: string | null
  campaign: string | null
  content: string | null
  term: string | null
  fbclid: string | null
  gclid: string | null
}

export const EMPTY_UTM: FunnelUtm = {
  source: null, medium: null, campaign: null, content: null, term: null, fbclid: null, gclid: null,
}

/** Capture-once attribution: reads UTM/click-ids from the URL on mount and
 *  persists per funnel so they survive the multi-step flow + refresh. */
export function useFunnelUtm(slug: FunnelSlug): FunnelUtm {
  const [utm, setUtm] = usePersistedState<FunnelUtm>(funnelUtmKey(slug), EMPTY_UTM)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const p = new URLSearchParams(window.location.search)
    const captured: FunnelUtm = {
      source: p.get('utm_source'),
      medium: p.get('utm_medium'),
      campaign: p.get('utm_campaign'),
      content: p.get('utm_content'),
      term: p.get('utm_term'),
      fbclid: p.get('fbclid'),
      gclid: p.get('gclid'),
    }
    // Only overwrite if this visit carries attribution — don't wipe a prior
    // capture on an internal refresh with a clean URL.
    const hasAny = Object.values(captured).some(Boolean)
    if (hasAny) {
      setUtm(captured)
    }
  }, [setUtm])

  return utm
}
```

- [ ] **Step 3: Verify** — `pnpm tsc 2>&1 | grep -E "use-funnel-utm|storage-keys"` → no output (clean). Then `pnpm lint:fix && pnpm lint 2>&1 | grep -E "use-funnel-utm|storage-keys"` → no errors.

- [ ] **Step 4: Commit**

```bash
git status --short
git commit -m "feat(funnels): useFunnelUtm hook + UTM storage key (ctx foundation)" -- src/shared/domains/funnels/hooks/use-funnel-utm.ts src/shared/domains/funnels/constants/storage-keys.ts
```

---

### Task 2: Rewrite `types.ts` to the hardened model

**Files:**
- Modify (full rewrite): `src/shared/domains/funnels/types.ts`

**Interfaces:**
- Consumes: `FunnelSlug` (constants/slugs), `FunnelUtm` (Task 1).
- Produces: `StepId`, `AnswerByKind`, `AnswerOf<S>`, `AnswerValue`, `FunnelAnswers`, `OptionContent`, `HeroContent`, `CardSelectContent`, `ContentByKind`, `ContentOf<S>`, `InfoStep`, `CardSelectStep`, `FunnelStep`, `StepKind`, `FunnelTheme`, `FunnelContext`, `StepProps<S>`, `StepComponentFor<K>`, `StepRegistry`, `FunnelPixel`, `FunnelSpec`, `AnswersOf<Steps>`.
- Removes: `FunnelContent`, `StepContent`, `StepComponent`, and the old `StepProps` (`funnelContent`/`content?`/`onChange`).

- [ ] **Step 1: Replace the entire file** with:

```ts
import type { ComponentType } from 'react'
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import type { FunnelUtm } from '@/shared/domains/funnels/hooks/use-funnel-utm'

/** A step's stable identifier, unique within a funnel. Doubles as its answer key. */
export type StepId = string

// ── Answers: one typed slot per step id (composites become objects in 2b) ──

/** kind → that kind's answer shape. `never` = the step takes no input. New kinds
 *  (location, pii-form, …) extend this in lockstep with FunnelStep + STEP_REGISTRY. */
export interface AnswerByKind {
  'info': never
  'card-select': string
}
export type AnswerOf<S extends FunnelStep> = AnswerByKind[S['kind']]

/** Runtime store value — the union of all answer shapes. Stays in sync with
 *  AnswerByKind automatically. Strong typing happens at the component boundary
 *  (AnswerOf<S>) and the opt-in AnswersOf<> author view. */
export type AnswerValue = AnswerByKind[keyof AnswerByKind] | null
export type FunnelAnswers = Partial<Record<StepId, AnswerValue>>

// ── Per-kind content (no shared kitchen-sink type) ──

export interface OptionContent { label: string, icon?: string, description?: string }
export interface HeroContent { headline: string, subhead: string, scarcityLine: string, cta: string }
export interface CardSelectContent { title: string, subtitle?: string, options: Record<string, OptionContent> }

/** kind → that kind's content shape. Extended in lockstep with new kinds. */
export interface ContentByKind {
  'info': HeroContent
  'card-select': CardSelectContent
}
export type ContentOf<S extends FunnelStep> = ContentByKind[S['kind']]

// ── Steps: a discriminated union; `content` is a typed field on each variant ──

interface BaseStep<K extends string> { id: StepId, kind: K }
export interface InfoStep extends BaseStep<'info'> { content: HeroContent }
export interface CardSelectStep extends BaseStep<'card-select'> { optionIds: string[], content: CardSelectContent }

export type FunnelStep = InfoStep | CardSelectStep
export type StepKind = FunnelStep['kind']

// ── Funnel-level context every step reads (this is what removes the need to
//    special-case lead/composite steps in the engine) ──

export interface FunnelTheme { accent: string }
export interface FunnelContext {
  slug: FunnelSlug
  offer: string
  theme: FunnelTheme
  utm: FunnelUtm
}

// ── Uniform step props — identical for every kind ──

export interface StepProps<S extends FunnelStep = FunnelStep> {
  step: S
  content: ContentOf<S>
  value: AnswerOf<S> | null
  setValue: (answer: AnswerOf<S>) => void
  answers: FunnelAnswers
  ctx: FunnelContext
  advance: () => void
  back: () => void
  isFirst: boolean
}

export type StepComponentFor<K extends StepKind> = ComponentType<StepProps<Extract<FunnelStep, { kind: K }>>>
export type StepRegistry = { [K in StepKind]: StepComponentFor<K> }

// ── FunnelSpec: ordered steps + branching + metadata. No content map. ──

export interface FunnelPixel { contentCategory: string }
export interface FunnelSpec {
  slug: FunnelSlug
  offer: string
  title: string
  theme: FunnelTheme
  pixel: FunnelPixel
  steps: FunnelStep[]
  flow?: (answers: FunnelAnswers, currentStepId: StepId) => StepId | null
}

/** Opt-in typed view of accumulated answers, keyed by step id — for `flow` and
 *  lead-building author sites only (requires `steps as const satisfies …`).
 *  Engine internals stay on the loose FunnelAnswers. */
export type AnswersOf<Steps extends readonly FunnelStep[]> = {
  [S in Steps[number] as S['id']]?: AnswerOf<S>
}
```

- [ ] **Step 2: Sweep for stale references to removed types** across the domain:

Run: `grep -rn "FunnelContent\|StepContent\|funnelContent\|\.content\.copy\|onChange" src/shared/domains/funnels/`
Expected: matches only in the files this plan rewrites next (`use-funnel-engine.ts`, `funnel-engine.tsx`, `ui/steps/*.tsx`, `constants/{kitchens,bathrooms,complete-interior}.ts`). If any match exists OUTSIDE those files, stop and report it.

- [ ] **Step 3: tsc** — `pnpm tsc 2>&1 | grep "domains/funnels"`
Expected: `types.ts` itself has **no** errors; errors appear only in the consumers updated by Tasks 3–6 (`use-funnel-engine.ts`, `funnel-engine.tsx`, `ui/steps/info-step.tsx`, `ui/steps/card-select-step.tsx`, `constants/kitchens.ts`). This is expected mid-refactor.

- [ ] **Step 4: Commit**

```bash
git status --short
git commit -m "refactor(funnels): hardened type model (per-kind content/answer, ctx, setValue)" -- src/shared/domains/funnels/types.ts
```

---

### Task 3: Update the engine hook (`use-funnel-engine.ts`)

Key answers by **step id** (drop the `field` concept); expose `value`/`setAnswer` for the current step; keep the hydration gate, history/back, and `flow?`/linear default.

**Files:**
- Modify (full rewrite): `src/shared/domains/funnels/hooks/use-funnel-engine.ts`

**Interfaces:**
- Consumes: `AnswerValue`, `FunnelAnswers`, `FunnelSpec`, `FunnelStep`, `StepId` (types), `funnelStateKey`, `defaultLinearNext`, `usePersistedState`.
- Produces: `FunnelEngineApi` ({ `step: FunnelStep`, `value: AnswerValue`, `answers: FunnelAnswers`, `isFirst: boolean`, `setAnswer: (value: AnswerValue) => void`, `advance(): void`, `back(): void`, `reset(): void` }); `useFunnelEngine(spec): FunnelEngineApi`.

- [ ] **Step 1: Replace the entire file** with:

```ts
import type { AnswerValue, FunnelAnswers, FunnelSpec, FunnelStep, StepId } from '@/shared/domains/funnels/types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { funnelStateKey } from '@/shared/domains/funnels/constants/storage-keys'
import { defaultLinearNext } from '@/shared/domains/funnels/lib/funnel-flow'
import { usePersistedState } from '@/shared/hooks/use-persisted-state'

interface EngineState {
  currentStepId: StepId
  history: StepId[]
  answers: FunnelAnswers
}

export interface FunnelEngineApi {
  step: FunnelStep
  value: AnswerValue
  answers: FunnelAnswers
  isFirst: boolean
  setAnswer: (value: AnswerValue) => void
  advance: () => void
  back: () => void
  reset: () => void
}

export function useFunnelEngine(spec: FunnelSpec): FunnelEngineApi {
  const initial = useMemo<EngineState>(() => ({
    currentStepId: spec.steps[0].id,
    history: [],
    answers: {},
  }), [spec.steps])
  const [state, setState] = usePersistedState<EngineState>(funnelStateKey(spec.slug), initial)

  // Hydration gate: render the default initial state on first client paint
  // (matching SSR), then switch to persisted state after mount.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])
  const effective = hydrated ? state : initial

  const step = useMemo(() => {
    const found = spec.steps.find(s => s.id === effective.currentStepId)
    // Spec changed under a resumed state (step id removed) → restart safely.
    return found ?? spec.steps[0]
  }, [spec.steps, effective.currentStepId])

  // One typed slot per step, keyed by step id (no `field`).
  const value = effective.answers[step.id] ?? null

  const setAnswer = useCallback((next: AnswerValue) => {
    setState(prev => ({ ...prev, answers: { ...prev.answers, [step.id]: next } }))
  }, [step.id, setState])

  const advance = useCallback(() => {
    setState((prev) => {
      const nextId = spec.flow
        ? spec.flow(prev.answers, prev.currentStepId)
        : defaultLinearNext(spec.steps, prev.currentStepId)
      if (!nextId || nextId === prev.currentStepId) {
        return prev
      }
      return { ...prev, currentStepId: nextId, history: [...prev.history, prev.currentStepId] }
    })
  }, [spec, setState])

  const back = useCallback(() => {
    setState((prev) => {
      if (prev.history.length === 0) {
        return prev
      }
      const history = [...prev.history]
      const previousId = history.pop() as StepId
      return { ...prev, currentStepId: previousId, history }
    })
  }, [setState])

  const reset = useCallback(() => setState(initial), [setState, initial])

  return {
    step,
    value,
    answers: effective.answers,
    isFirst: effective.history.length === 0,
    setAnswer,
    advance,
    back,
    reset,
  }
}
```

- [ ] **Step 2: tsc** — `pnpm tsc 2>&1 | grep "use-funnel-engine"` → no output. (Errors remain in `funnel-engine.tsx`, the step components, and `kitchens.ts` — expected.)

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "refactor(funnels): engine keys answers by step id; setAnswer + AnswerValue" -- src/shared/domains/funnels/hooks/use-funnel-engine.ts
```

---

### Task 4: Update the step components (`info-step.tsx`, `card-select-step.tsx`)

Adapt both to the new uniform `StepProps<S>` (typed `content`, `value`, `setValue`, `ctx`). `card-select` uses `setValue` then `advance` on tap.

**Files:**
- Modify (full rewrite): `src/shared/domains/funnels/ui/steps/info-step.tsx`
- Modify (full rewrite): `src/shared/domains/funnels/ui/steps/card-select-step.tsx`

**Interfaces:**
- Consumes: `InfoStep`/`CardSelectStep` + `StepProps` (types), `Button`, `cn`.
- Produces: `InfoStepView`, `CardSelectStepView` (each `ComponentType<StepProps<S>>` for its kind).

- [ ] **Step 1: Rewrite `info-step.tsx`** (hero copy now comes from the typed `content: HeroContent`):

```tsx
import type { InfoStep, StepProps } from '@/shared/domains/funnels/types'
import { Button } from '@/shared/components/ui/button'

export function InfoStepView({ content, advance }: StepProps<InfoStep>) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium">
        {content.scarcityLine}
      </span>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{content.headline}</h1>
      <p className="text-muted-foreground max-w-prose">{content.subhead}</p>
      <Button size="lg" onClick={advance}>{content.cta}</Button>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `card-select-step.tsx`** (`setValue` replaces `onChange`; `advance`/`back` replace `onAdvance`/`onBack`):

```tsx
import type { CardSelectStep, StepProps } from '@/shared/domains/funnels/types'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

export function CardSelectStepView({ step, content, value, setValue, advance, back, isFirst }: StepProps<CardSelectStep>) {
  function handleSelect(optionId: string) {
    setValue(optionId)
    // Micro-commitment: a tap advances immediately.
    advance()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{content.title}</h2>
        {content.subtitle
          ? <p className="text-muted-foreground mt-1">{content.subtitle}</p>
          : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {step.optionIds.map((optionId) => {
          const option = content.options[optionId]
          const selected = value === optionId
          return (
            <button
              key={optionId}
              type="button"
              onClick={() => handleSelect(optionId)}
              className={cn(
                'rounded-xl border-2 p-5 text-left transition-colors hover:border-primary/60',
                selected ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              <span className="block font-medium">{option?.label ?? optionId}</span>
              {option?.description
                ? <span className="text-muted-foreground mt-1 block text-sm">{option.description}</span>
                : null}
            </button>
          )
        })}
      </div>
      {!isFirst
        ? (
            <div className="flex justify-start">
              <Button variant="ghost" onClick={back}>← Back</Button>
            </div>
          )
        : null}
    </div>
  )
}
```

- [ ] **Step 3: tsc** — `pnpm tsc 2>&1 | grep "ui/steps"` → no output. (Errors remain only in `funnel-engine.tsx` and `kitchens.ts`.)

- [ ] **Step 4: Commit**

```bash
git status --short
git commit -m "refactor(funnels): step components consume uniform StepProps (content/value/setValue/ctx)" -- src/shared/domains/funnels/ui/steps/info-step.tsx src/shared/domains/funnels/ui/steps/card-select-step.tsx
```

---

### Task 5: Update the engine shell (`funnel-engine.tsx`)

Build `ctx` (with captured UTM), dispatch through the mapped registry with **one documented seam cast**, and pass uniform props. No `content.copy` lookup (content is `step.content`).

**Files:**
- Modify (full rewrite): `src/shared/domains/funnels/ui/funnel-engine.tsx`

**Interfaces:**
- Consumes: `getFunnel`, `useFunnelEngine`, `useFunnelUtm`, `STEP_REGISTRY`, `FunnelProgress`, motion constants, and types `FunnelSlug`/`FunnelContext`/`StepProps`/`ComponentType`.

- [ ] **Step 1: Replace the entire file** with:

```tsx
'use client'

import type { ComponentType } from 'react'
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import type { FunnelContext, StepProps } from '@/shared/domains/funnels/types'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMemo } from 'react'
import { FUNNEL_TRANSITION, STEP_VARIANTS } from '@/shared/domains/funnels/constants/funnel-motion'
import { STEP_REGISTRY } from '@/shared/domains/funnels/constants/step-registry'
import { useFunnelEngine } from '@/shared/domains/funnels/hooks/use-funnel-engine'
import { useFunnelUtm } from '@/shared/domains/funnels/hooks/use-funnel-utm'
import { getFunnel } from '@/shared/domains/funnels/lib/registry'
import { FunnelProgress } from '@/shared/domains/funnels/ui/funnel-progress'

/**
 * Accepts `slug` (serializable) and resolves the spec on the client (the spec
 * contains functions and can't cross the server→client boundary).
 */
export function FunnelEngine({ slug }: { slug: FunnelSlug }) {
  const spec = getFunnel(slug)
  const engine = useFunnelEngine(spec)
  const utm = useFunnelUtm(slug)
  const reduceMotion = useReducedMotion()

  // Ambient funnel-level context handed to every step (e.g. the lead step will
  // read ctx.utm/offer/slug here in 2b — no engine special-case needed).
  const ctx = useMemo<FunnelContext>(
    () => ({ slug: spec.slug, offer: spec.offer, theme: spec.theme, utm }),
    [spec, utm],
  )

  const currentIndex = spec.steps.findIndex(s => s.id === engine.step.id)

  // Single documented dispatch seam: the registry is typed per kind, but indexing
  // by a union `kind` widens the lookup. Re-narrow here with the ONE cast; each
  // step component stays fully typed against its own StepProps<S>.
  const StepView = STEP_REGISTRY[engine.step.kind] as ComponentType<StepProps>

  return (
    <div data-funnel={spec.slug} className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-8 px-5 py-10">
      <FunnelProgress total={spec.steps.length} currentIndex={currentIndex} />
      <AnimatePresence mode="wait">
        <motion.div
          key={engine.step.id}
          initial={reduceMotion ? false : STEP_VARIANTS.initial}
          animate={STEP_VARIANTS.animate}
          exit={reduceMotion ? undefined : STEP_VARIANTS.exit}
          transition={FUNNEL_TRANSITION}
          className="flex-1"
        >
          <StepView
            step={engine.step}
            content={engine.step.content}
            value={engine.value}
            setValue={engine.setAnswer}
            answers={engine.answers}
            ctx={ctx}
            advance={engine.advance}
            back={engine.back}
            isFirst={engine.isFirst}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: tsc** — `pnpm tsc 2>&1 | grep "funnel-engine"` → no output. (Only `constants/kitchens.ts` + the two stubs may still error until Task 6 — expected.)

- [ ] **Step 3: Commit**

```bash
git status --short
git commit -m "refactor(funnels): engine shell builds ctx + uniform dispatch (one seam cast)" -- src/shared/domains/funnels/ui/funnel-engine.tsx
```

---

### Task 6: Rewrite the funnel specs (`kitchens.ts`, `bathrooms.ts`, `complete-interior.ts`)

Move hero copy into the hero step's typed `content`; add `offer`/`title`; inline per-step content; drop the `content.copy` map. After this task the whole tree is `tsc`-clean.

**Files:**
- Modify (full rewrite): `src/shared/domains/funnels/constants/kitchens.ts`
- Modify (full rewrite): `src/shared/domains/funnels/constants/bathrooms.ts`
- Modify (full rewrite): `src/shared/domains/funnels/constants/complete-interior.ts`

**Interfaces:**
- Consumes: `FunnelSpec` (types).
- Produces: `kitchensFunnel`, `bathroomsFunnel`, `completeInteriorFunnel` (each `satisfies FunnelSpec`, consumed by `lib/registry.ts`).

- [ ] **Step 1: Rewrite `kitchens.ts`** (hero is `steps[0]`; no `flow` → linear):

```ts
import type { FunnelSpec } from '@/shared/domains/funnels/types'

export const kitchensFunnel: FunnelSpec = {
  slug: 'kitchens',
  offer: 'showcase',
  title: 'Kitchen Showcase',
  theme: { accent: 'primary' },
  pixel: { contentCategory: 'kitchen' },
  // Linear funnel: no `flow` — the engine advances through `steps` in order.
  steps: [
    {
      id: 'hero',
      kind: 'info',
      content: {
        headline: 'Get a AAA-grade kitchen remodel — at a Showcase price.',
        subhead: 'See if your home qualifies for one of our Showcase kitchens.',
        scarcityLine: 'We\'re selecting 5 kitchens in your area.',
        cta: 'See if my kitchen qualifies →',
      },
    },
    {
      id: 'layout',
      kind: 'card-select',
      optionIds: ['l-shape', 'u-shape', 'galley', 'island', 'open', 'not-sure'],
      content: {
        title: 'Which best describes your kitchen?',
        options: {
          'l-shape': { label: 'L-shaped' },
          'u-shape': { label: 'U-shaped' },
          'galley': { label: 'Galley' },
          'island': { label: 'Has an island' },
          'open': { label: 'Open-concept' },
          'not-sure': { label: 'Not sure' },
        },
      },
    },
    {
      id: 'ownership',
      kind: 'card-select',
      optionIds: ['own', 'rent'],
      content: {
        title: 'Do you own or rent your home?',
        subtitle: 'Showcase projects are available to homeowners.',
        options: {
          own: { label: 'I own my home' },
          rent: { label: 'I rent' },
        },
      },
    },
  ],
}
```

- [ ] **Step 2: Rewrite `bathrooms.ts`** (metadata-only stub; steps filled in Plan 2b/4):

```ts
import type { FunnelSpec } from '@/shared/domains/funnels/types'

/** Bathroom Showcase funnel. Stub: metadata only; Plan 2b/4 fills steps. */
export const bathroomsFunnel: FunnelSpec = {
  slug: 'bathrooms',
  offer: 'showcase',
  title: 'Bathroom Showcase',
  theme: { accent: 'primary' },
  pixel: { contentCategory: 'bathroom' },
  steps: [],
}
```

- [ ] **Step 3: Rewrite `complete-interior.ts`** (same stub shape):

```ts
import type { FunnelSpec } from '@/shared/domains/funnels/types'

/** Complete-Interior Showcase funnel. Stub: metadata only; Plan 2b/4 fills steps. */
export const completeInteriorFunnel: FunnelSpec = {
  slug: 'complete-interior',
  offer: 'showcase',
  title: 'Complete-Interior Showcase',
  theme: { accent: 'primary' },
  pixel: { contentCategory: 'complete-interior' },
  steps: [],
}
```

> Note: the two stubs have empty `steps` and are not meant to render yet — visiting their subdomains would throw at `spec.steps[0]` (pre-existing behavior, unchanged; Plan 2b/4 fills them). Only `kitchens` is exercised below.

- [ ] **Step 4: Full type-check + lint** — the tree is now complete:

Run: `pnpm tsc 2>&1 | grep "domains/funnels"` → **no output**.
Run: `pnpm lint:fix && pnpm lint 2>&1 | grep "domains/funnels"` → **no errors** (warnings like the `setHydrated`-in-effect hydration-gate warning are pre-existing and acceptable).

- [ ] **Step 5: Commit**

```bash
git status --short
git commit -m "refactor(funnels): specs use offer/title + inline per-step content (hero is steps[0])" -- src/shared/domains/funnels/constants/kitchens.ts src/shared/domains/funnels/constants/bathrooms.ts src/shared/domains/funnels/constants/complete-interior.ts
```

---

### Task 7: End-to-end runtime smoke (kitchen funnel)

Prove the rewritten engine drives the funnel and survives refresh, in a real browser. No code changes unless the smoke surfaces a defect.

**Files:** none (verification only).

- [ ] **Step 1: Ensure dev is running** — `pnpm dev` (port 3000). Confirm `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/funnels/kitchens` returns `200`.

- [ ] **Step 2: Walk the flow** at `http://localhost:3000/funnels/kitchens` (browser or Playwright MCP):
  1. **Hero** renders the scarcity line, headline "Get a AAA-grade kitchen remodel — at a Showcase price.", subhead, and CTA "See if my kitchen qualifies →".
  2. Click the CTA → advances (linear default, no `flow`) to **layout** (6 cards + a "← Back" only if not first; hero is first so layout shows Back).
  3. Click a layout card → **auto-advances** to **ownership** (subtitle "Showcase projects are available to homeowners.", 2 cards, Back).
  4. Click **← Back** → returns to layout with the previously selected card still highlighted (answer preserved).
  5. Refresh the page on the ownership step → **resumes on ownership** (persistence intact through the rewrite).

- [ ] **Step 3: Console must be clean** — capture console errors for the final navigation only (not the whole session). Expected: **0 errors** except the known `manifest.webmanifest` / `logo-light.svg` 404s on the subdomain host (pre-existing M4 finding, unrelated). A React hooks-order or hydration error is a FAIL — fix before proceeding.

- [ ] **Step 4: Record evidence** in the task report (which steps rendered, resume confirmed, console state). No commit unless a fix was required (then commit it pathspec-scoped).

---

## Follow-up (NOT part of this plan)

Re-cut Plans 2b/2c against this model **before implementing them**:
- **2b** drops Task 5 Step 0 (`setAnswers`) and Task 7 (the `pii-form` engine special-case) entirely. `location`/`pii-form` are added by extending `FunnelStep` + `AnswerByKind` (with `LocationAnswer`/`PiiAnswer` composite objects) + `ContentByKind` + `STEP_REGISTRY` in lockstep (tsc forces all four). `useFunnelUtm` already exists (Task 1 here) — 2b consumes it. The pii step reads `ctx.offer/slug/utm` and creates the lead through the customers/leads entity router's public entrypoint, then `setValue({ leadId })`.
- **2c** adds `datetime`/`confirmation` kinds the same way; branching funnels add a `flow` typed via the opt-in `AnswersOf<typeof STEPS>` view (note: exercising `AnswersOf` requires authoring `steps` with `as const satisfies readonly FunnelStep[]`, which may need `optionIds: readonly string[]` — decide at 2c time).

---

## Self-Review

- **Spec coverage:** per-kind content via `ContentByKind` (Task 2) ✅ [goal 1]; uniform `ctx`-carrying `StepProps` + single dispatch (Tasks 2,5) ✅ [goal 2]; composite-ready answers + single `setValue`, one slot per step id (Tasks 2,3) ✅ [answer model]; no content map / hero-as-step (Tasks 2,6) ✅ [goal 4]; `as const satisfies`, no factory (Task 6) ✅; cast-free except one documented seam (Task 5) ✅; opt-in `AnswersOf` not engine-wide (Task 2) ✅; `ctx.utm` foundation (Task 1) ✅; stop-lines honored (no XState/store/factory/Seam-B) ✅. Self-contained library steps (`export const ZIP_STEP`) are demonstrated in the 2b follow-up, not this plan (no location kind here) — noted.
- **Placeholder scan:** none — full file contents in every rewrite step; exact grep/tsc/lint commands with expected output.
- **Type consistency:** `FunnelEngineApi.setAnswer(value: AnswerValue)` (Task 3) ↔ `StepProps.setValue(a: AnswerOf<S>)` bound at the dispatch seam (Task 5, contravariantly sound); `AnswerValue = AnswerByKind[keyof AnswerByKind] | null` auto-syncs with `AnswerByKind` (Task 2); `STEP_REGISTRY` keys (`info`,`card-select`) match `StepKind` exactly (exhaustive); `content`/`value`/`ctx` prop names identical across Tasks 2/4/5; `funnelStateKey`/`funnelUtmKey` both from `constants/storage-keys.ts`.
- **Scope:** only `info`+`card-select` implemented; `location`/`pii-form` deferred to the 2b re-cut (forced-exhaustive extension) — stated in Global Constraints + Follow-up.
