# Multi-Step-Flow Core Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a neutral, framework-level `multi-step-flow` package (plus a relocated `Block` compound) that any ordered step-flow engine can build on, extracted and generalized from the proven funnels engine — without touching funnel behavior.

**Architecture:** Net-new, generically-typed infrastructure under `src/shared/domains/multi-step-flow/` — a `FlowConfig` + `BaseStep`/`StepProps` contract, a `useStepEngine` reducer whose only variable seam is an injected `StepPersistenceAdapter`, a slotted `StepShell`, and small UI/lib/constants helpers. The funnels engine keeps its private copies this phase (migration is deferred); the sole funnel-touching change is relocating the already-neutral `Block` compound to `src/shared/components/block/` and repointing its 11 importers. A tiny in-repo reference flow on a dev-only route is the manual smoke-test.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, `motion/react` (NOT framer-motion), Tailwind v4, shadcn/ui `Button`, `class-variance-authority`, `@radix-ui/react-slot`, pnpm.

## Global Constraints

Every task's requirements implicitly include this section.

- **No "funnel" language anywhere in the new package** — identifiers, comments, CSS classes, file names, storage keys. Neutral terms only (see the naming table in the spec).
- **Funnels engine stays untouched and behaviorally identical this phase** — the ONLY funnel-touching change permitted is the `Block` relocation + import rewrite (Task 1). Do not edit `use-funnel-engine.ts`, `funnel-engine.tsx`, `funnels/types.ts`, `funnel-motion.ts`, or any step under `funnels/`.
- **Conservative API — YAGNI.** Generalize only what funnels (today) and applications (next) provably need. No speculative slots, options, or generic parameters.
- **No test suite exists.** Validation is `pnpm tsc` (runs `tsc --noEmit`) clean + `pnpm lint` (runs `next lint`) clean + a manual smoke-test of the reference flow. Do NOT add a test runner, `*.test.ts`, or `*.spec.ts` files.
- **Lint style is antfu** (no semicolons, single quotes, 2-space, arrow-parens, import order). `pnpm lint:fix` auto-fixes formatting; run it before the final `pnpm lint`.
- **Conventions:** named exports only (Next.js `page.tsx`/`layout.tsx` default exports are the sole exception); one component per file; `motion/react` import specifier; path alias `@/` → `src/`.
- **Git:** stage explicitly by path — never `git add -A`. Commit/branch/push only per the executing skill's cadence; if on `main`, branch first (`feat/multi-step-flow-core-extraction`). The commit steps below list exact paths.
- **Before implementing,** the repo's `convention-auditor` agent may be invoked for a task-scoped checklist (optional but recommended for the funnel-touching Task 1).

---

## File Structure

**Relocated (Task 1):**
- `src/shared/components/block/` — the `Block` compound, moved wholesale from `src/shared/domains/funnels/ui/block/` (12 files). One responsibility: the presentational marketing-block compound. RSC-safe.

**Net-new package `src/shared/domains/multi-step-flow/`:**
- `types.ts` — the generic contract: `StepId`, `StepAnswers`, `BaseStep`, `StepProps`, `StepRegistry`, `FlowConfig`, `EngineState`, `StepPersistenceAdapter`, option types.
- `constants/step-motion.ts` — neutral motion tokens (`STEP_TRANSITION`, `STEP_VARIANTS`, card stagger, CTA).
- `constants/layout.ts` — neutral layout tokens (`RAIL_MAX_W`, `QUESTION_MAX_W`, `CARD_SELECT_SINGLE_COLUMN_THRESHOLD`).
- `lib/linear-next.ts` — `linearNext(steps, currentStepId)`.
- `lib/scroll-to-top.ts` — `scrollToTop(target?)`.
- `lib/card-options.ts` — option-authoring helpers (`img`/`icon`/`text`/`cardOptions`), path convention decoupled via an injected resolver.
- `hooks/use-step-engine.ts` — the reducer + injected persistence adapter + hydration gate; exports `StepEngineApi`, `useStepEngine`.
- `ui/step-progress.tsx` — `StepProgress` animated bar.
- `ui/card-option.tsx` — `CardOption` presentational primitive (asset rendering pluggable).
- `ui/step-shell.tsx` — slotted `StepShell` (landing → steps → terminal).
- `example/reference-adapter.ts` — in-memory `StepPersistenceAdapter`.
- `example/reference-flow.tsx` — minimal 4-view consumer flow.
- `README.md` — what the package is + how to build a consumer engine.

**Net-new dev route (Task 8):**
- `src/app/(frontend)/dev/multi-step-flow/layout.tsx` — re-asserts `bg-background text-foreground` (root `<html>` is `dark`-pinned), mirrors `src/app/(frontend)/test/layout.tsx`.
- `src/app/(frontend)/dev/multi-step-flow/page.tsx` — renders `<ReferenceFlow />`. NOT linked from production nav.

---

### Task 1: Relocate the `Block` compound + rewrite its importers

Moves the already-neutral, RSC-safe `Block` compound to a shared UI home and repoints all 11 funnel importers. This is the only funnel-touching change in the whole plan; it is a mechanical path move with zero behavioral change.

**Files:**
- Create dir `src/shared/components/block/` with these 12 files moved from `src/shared/domains/funnels/ui/block/`:
  `block.tsx`, `block-root.tsx`, `block-variants.ts`, `block-content.tsx`, `block-body.tsx`, `block-headline.tsx`, `block-eyebrow.tsx`, `block-divider.tsx`, `block-media.tsx`, `block-decor.tsx`, `block-actions.tsx`, `block-trust.tsx`
- Delete dir `src/shared/domains/funnels/ui/block/` (after move)
- Modify (import path only), each currently importing `import { Block } from '@/shared/domains/funnels/ui/block/block'`:
  - `src/shared/domains/funnels/ui/blocks/value-block.tsx`
  - `src/shared/domains/funnels/ui/blocks/problem-block.tsx`
  - `src/shared/domains/funnels/ui/blocks/guarantee-block.tsx`
  - `src/shared/domains/funnels/ui/blocks/process-block.tsx`
  - `src/shared/domains/funnels/ui/blocks/licensing-block.tsx`
  - `src/shared/domains/funnels/ui/blocks/cta-block.tsx`
  - `src/shared/domains/funnels/ui/blocks/testimonials-block.tsx`
  - `src/shared/domains/funnels/ui/blocks/callout-block.tsx`
  - `src/shared/domains/funnels/ui/blocks/portfolio-block.tsx`
  - `src/shared/domains/funnels/ui/blocks/reviews-block.tsx`
  - `src/shared/domains/funnels/ui/blocks/faq-block.tsx`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `Block` (default compound) + flat re-exports `BlockActions, BlockBody, BlockContent, BlockDecor, BlockDivider, BlockEyebrow, BlockHeadline, BlockMedia, BlockRoot, BlockTrust` — now importable from `@/shared/components/block/block`. Public compound API unchanged.

- [ ] **Step 1: Move the directory verbatim (preserve git history)**

```bash
git mv src/shared/domains/funnels/ui/block src/shared/components/block
```

If `git mv` errors because the target parent doesn't exist, create it first: `mkdir -p src/shared/components && git mv src/shared/domains/funnels/ui/block src/shared/components/block`.

- [ ] **Step 2: De-funnel the docblock in `block.tsx`**

Open `src/shared/components/block/block.tsx`. If any comment mentions "funnel", reword to describe it as a generic marketing/content block compound. Do NOT change any code, export, or `--block-*` token. If no such comment exists, skip.

- [ ] **Step 3: Repoint all 11 importers**

In each of the 11 files listed under **Modify** above, change the import specifier only:

```ts
// before
import { Block } from '@/shared/domains/funnels/ui/block/block'
// after
import { Block } from '@/shared/components/block/block'
```

Nothing else in those files changes. (Verified: no file imports the flat sub-components or the internal `block-*` sub-paths directly — the compound namespace is the only surface.)

- [ ] **Step 4: Verify no stale references remain**

```bash
grep -rn "domains/funnels/ui/block" src/
```

Expected: **no matches**. If any appear, repoint them the same way.

- [ ] **Step 5: Type-check and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: both clean. (If lint flags import ordering in a touched file, run `pnpm lint:fix`.)

- [ ] **Step 6: Commit**

```bash
git add src/shared/components/block src/shared/domains/funnels/ui/blocks
git commit -m "refactor(block): relocate Block compound to shared/components/block"
```

---

### Task 2: Core contract types (`types.ts`)

The generic, funnel-free contract every consumer engine builds against. Pure types — no runtime.

**Files:**
- Create: `src/shared/domains/multi-step-flow/types.ts`

**Interfaces:**
- Consumes: nothing runtime.
- Produces: `StepId`, `StepAnswers`, `BaseStep<K>`, `StepProps<Content, Answer, Ctx>`, `StepRegistry<Kinds>`, `FlowConfig<Step, Ctx>`, `EngineState`, `StepPersistenceAdapter<State>`, `OptionAsset`, `CardOption`.

- [ ] **Step 1: Write the file**

```ts
import type { ComponentType } from 'react'

/** A step's stable identifier. Doubles as the key for that step's answer slot. */
export type StepId = string

/** One answer slot per step id. Answer shapes are owned by each consumer engine. */
export type StepAnswers = Partial<Record<StepId, unknown>>

/** The minimal shape every step shares. Consumers extend this per kind (usually adding `content`). */
export interface BaseStep<K extends string> {
  id: StepId
  kind: K
}

/**
 * Uniform props every step component receives. Generic over the consumer's
 * content, answer, and context types — the core never names them.
 */
export interface StepProps<Content, Answer, Ctx> {
  step: BaseStep<string>
  content: Content
  value: Answer | null
  isAnswered: boolean
  setValue: (answer: Answer) => void
  answers: StepAnswers
  ctx: Ctx
  advance: () => void
  back: () => void
  isFirst: boolean
}

/**
 * A consumer builds its own registry from its own `kind -> component` map.
 * The `any` triple is the single documented widening at the dispatch seam
 * (each component is authored against its own narrow `StepProps`).
 */
export type StepRegistry<Kinds extends string> = Record<
  Kinds,
  ComponentType<StepProps<any, any, any>>
>

/** The declarative flow definition: ordered steps + optional branching + view hints. */
export interface FlowConfig<Step extends BaseStep<string>, Ctx> {
  steps: Step[]
  /** Optional branching. Falls back to linear progression when absent. */
  next?: (answers: StepAnswers, currentStepId: StepId) => StepId | null
  /** Which step renders as the landing view. Defaults to the first step. */
  landingStepId?: StepId
  /** Step kinds that render as the terminal view (no nav/progress). */
  terminalKinds?: readonly string[]
  /** Marker so `Ctx` is used and inferable at the config site. */
  __ctx?: Ctx
}

/** The engine's serialisable state. Persisted verbatim by the adapter. */
export interface EngineState {
  currentStepId: StepId
  history: StepId[]
  answers: StepAnswers
}

/**
 * The single seam that differs between engines.
 * localStorage: `load` reads synchronously, no `useHydration`.
 * DB: `load` returns the adapter's cached snapshot; `useHydration` reports
 * whether the async load has resolved.
 */
export interface StepPersistenceAdapter<State> {
  load: () => State | null
  persist: (next: State) => void
  useHydration?: () => boolean
}

/** Presentational option asset for card-style steps. */
export type OptionAsset =
  | { kind: 'icon', name: string }
  | { kind: 'image', src: string, alt: string }

/** A selectable card option. */
export interface CardOption {
  id: string
  label: string
  description?: string
  asset?: OptionAsset
}
```

> Note on `__ctx`: `Ctx` is otherwise only referenced through `StepProps<_, _, Ctx>` at call sites, so without a field TypeScript can't infer it from a `FlowConfig` literal. The optional `__ctx` marker keeps `Ctx` inferable without forcing a runtime value. If tsc infers `Ctx` correctly in Task 9 without it, delete the marker then.

- [ ] **Step 2: Type-check and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/multi-step-flow/types.ts
git commit -m "feat(multi-step-flow): core contract types"
```

---

### Task 3: Neutral motion + layout constants

Ports the generic subset of the funnel motion/layout tokens under neutral names. Hero/timeline/parallax motion is deliberately left out — it belongs to funnel chrome (deferred), not the neutral framework.

**Files:**
- Create: `src/shared/domains/multi-step-flow/constants/step-motion.ts`
- Create: `src/shared/domains/multi-step-flow/constants/layout.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `STEP_TRANSITION`, `STEP_VARIANTS`, `CARD_STAGGER_CONTAINER`, `CARD_STAGGER_ITEM`, `CTA_HOVER`, `CTA_TAP`, `CTA_PRESS_SPRING` (motion); `RAIL_MAX_W`, `QUESTION_MAX_W`, `CARD_SELECT_SINGLE_COLUMN_THRESHOLD` (layout).

- [ ] **Step 1: Write `constants/step-motion.ts`**

```ts
import type { TargetAndTransition, Transition, Variants } from 'motion/react'

/** Shared easing/timing for step + view transitions. */
export const STEP_TRANSITION: Transition = { duration: 0.18, ease: [0.32, 0.72, 0, 1] }

/** Per-step enter/exit for the keyed AnimatePresence stage. */
export const STEP_VARIANTS: Record<'initial' | 'animate' | 'exit', TargetAndTransition> = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

/** Stagger container for card grids/lists. */
export const CARD_STAGGER_CONTAINER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
}

/** Stagger item for individual cards. */
export const CARD_STAGGER_ITEM: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: STEP_TRANSITION },
}

export const CTA_HOVER: TargetAndTransition = { y: -2 }
export const CTA_TAP: TargetAndTransition = { scale: 0.97 }
export const CTA_PRESS_SPRING: Transition = { type: 'spring', stiffness: 400, damping: 17 }
```

- [ ] **Step 2: Write `constants/layout.ts`**

```ts
/** Whole-flow content rail max-width (landing/steps/terminal/header). */
export const RAIL_MAX_W = 'max-w-5xl'

/** Individual question column max-width. */
export const QUESTION_MAX_W = 'max-w-xl'

/** > this count -> single-column list; otherwise a 2-column grid. */
export const CARD_SELECT_SINGLE_COLUMN_THRESHOLD = 2
```

- [ ] **Step 3: Type-check and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: clean. (`motion/react` exports these types; if lint flags import order, `pnpm lint:fix`.)

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/multi-step-flow/constants
git commit -m "feat(multi-step-flow): neutral motion + layout constants"
```

---

### Task 4: Pure lib helpers (`linearNext`, `scrollToTop`, card-options)

The three stateless helpers. `linearNext` and `scrollToTop` are direct de-funnel'd ports; `cardOptions` is generalized so the funnel-specific `/funnels/<scope>/...` asset path convention is injected by the consumer rather than baked in.

**Files:**
- Create: `src/shared/domains/multi-step-flow/lib/linear-next.ts`
- Create: `src/shared/domains/multi-step-flow/lib/scroll-to-top.ts`
- Create: `src/shared/domains/multi-step-flow/lib/card-options.ts`

**Interfaces:**
- Consumes: `BaseStep`, `StepId`, `CardOption`, `OptionAsset` from `../types`.
- Produces: `linearNext(steps, currentStepId)`, `scrollToTop(target?)`, and option authors `img`/`icon`/`text` + `cardOptions(entries, resolveImageSrc?)`.

- [ ] **Step 1: Write `lib/linear-next.ts`**

```ts
import type { BaseStep, StepId } from '../types'

/** Next step id in declaration order, or null at the end. */
export function linearNext<Step extends BaseStep<string>>(
  steps: Step[],
  currentStepId: StepId,
): StepId | null {
  const i = steps.findIndex((s) => s.id === currentStepId)
  return i >= 0 && i < steps.length - 1 ? steps[i + 1].id : null
}
```

- [ ] **Step 2: Write `lib/scroll-to-top.ts`**

```ts
/**
 * Scroll a target element (an internally-scrolling stage / authenticated panel)
 * to top, or the window when no target is given. SSR-guarded.
 */
export function scrollToTop(target?: HTMLElement | null): void {
  if (target) {
    target.scrollTo({ top: 0, left: 0 })
    return
  }
  if (typeof window === 'undefined') {
    return
  }
  window.scrollTo({ top: 0, left: 0 })
}
```

- [ ] **Step 3: Write `lib/card-options.ts`**

```ts
import type { CardOption } from '../types'

interface BaseEntry { id: string, label: string, description?: string }
interface IconEntry extends BaseEntry { assetKind: 'icon', name: string }
interface ImageEntry extends BaseEntry { assetKind: 'image', alt: string }
interface TextEntry extends BaseEntry { assetKind: 'text' }
type OptionEntry = IconEntry | ImageEntry | TextEntry

/** Icon-backed option. `name` defaults to `id`. */
export function icon(
  id: string,
  label: string,
  opts?: { name?: string, description?: string },
): IconEntry {
  return { assetKind: 'icon', id, label, name: opts?.name ?? id, description: opts?.description }
}

/** Image-backed option. `alt` defaults to `label`; `src` is resolved by `cardOptions`. */
export function img(
  id: string,
  label: string,
  opts?: { alt?: string, description?: string },
): ImageEntry {
  return { assetKind: 'image', id, label, alt: opts?.alt ?? label, description: opts?.description }
}

/** Text-only option (no asset). */
export function text(
  id: string,
  label: string,
  opts?: { description?: string },
): TextEntry {
  return { assetKind: 'text', id, label, description: opts?.description }
}

/**
 * Build render-ordered CardOptions. Image `src` is supplied by the consumer's
 * resolver (e.g. funnels pass `(id) => `/funnels/${scope}/${dimension}/${id}.webp``);
 * the framework holds no asset-path convention of its own.
 */
export function cardOptions(
  entries: OptionEntry[],
  resolveImageSrc?: (id: string) => string,
): CardOption[] {
  return entries.map((e) => {
    if (e.assetKind === 'icon') {
      return { id: e.id, label: e.label, description: e.description, asset: { kind: 'icon', name: e.name } }
    }
    if (e.assetKind === 'image') {
      if (!resolveImageSrc) {
        throw new Error(`cardOptions: image option "${e.id}" needs a resolveImageSrc resolver`)
      }
      return {
        id: e.id,
        label: e.label,
        description: e.description,
        asset: { kind: 'image', src: resolveImageSrc(e.id), alt: e.alt },
      }
    }
    return { id: e.id, label: e.label, description: e.description }
  })
}
```

- [ ] **Step 4: Type-check and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/domains/multi-step-flow/lib
git commit -m "feat(multi-step-flow): linearNext, scrollToTop, card-option authors"
```

---

### Task 5: The state machine (`hooks/use-step-engine.ts`)

The pure reducer over `{ currentStepId, history, answers }` — the funnel engine's logic minus the hard-wired localStorage and window-scroll, with persistence and scroll injected. This is the heart of the framework.

**Files:**
- Create: `src/shared/domains/multi-step-flow/hooks/use-step-engine.ts`

**Interfaces:**
- Consumes: `BaseStep`, `EngineState`, `FlowConfig`, `StepAnswers`, `StepId`, `StepPersistenceAdapter` from `../types`; `linearNext` from `../lib/linear-next`.
- Produces:
  - `interface StepEngineApi { step: BaseStep<string>; value: unknown; answers: StepAnswers; isFirst: boolean; hasNext: boolean; setAnswer: (value: unknown) => void; advance: () => void; back: () => void; reset: () => void }`
  - `function useStepEngine<Step extends BaseStep<string>, Ctx>(config: FlowConfig<Step, Ctx>, adapter: StepPersistenceAdapter<EngineState>, options?: { onNavigate?: () => void }): StepEngineApi`

- [ ] **Step 1: Write the hook**

```ts
'use client'

import type { BaseStep, EngineState, FlowConfig, StepAnswers, StepId, StepPersistenceAdapter } from '../types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { linearNext } from '../lib/linear-next'

export interface StepEngineApi {
  step: BaseStep<string>
  value: unknown
  answers: StepAnswers
  isFirst: boolean
  hasNext: boolean
  setAnswer: (value: unknown) => void
  advance: () => void
  back: () => void
  reset: () => void
}

function computeNext<Step extends BaseStep<string>, Ctx>(
  config: FlowConfig<Step, Ctx>,
  answers: StepAnswers,
  currentStepId: StepId,
): StepId | null {
  return config.next ? config.next(answers, currentStepId) : linearNext(config.steps, currentStepId)
}

export function useStepEngine<Step extends BaseStep<string>, Ctx>(
  config: FlowConfig<Step, Ctx>,
  adapter: StepPersistenceAdapter<EngineState>,
  options?: { onNavigate?: () => void },
): StepEngineApi {
  const initial = useMemo<EngineState>(
    () => ({ currentStepId: config.steps[0]?.id ?? '', history: [], answers: {} }),
    [config.steps],
  )

  const [state, setState] = useState<EngineState>(initial)

  // Hydration gate: render `initial` on first paint (matches SSR), then adopt
  // persisted state after mount. `useHydration` lets a DB adapter defer until
  // its async load resolves; a localStorage adapter omits it (loads sync).
  const externalHydrated = adapter.useHydration?.() ?? true
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  const hydrated = mounted && externalHydrated

  useEffect(() => {
    if (!hydrated) {
      return
    }
    const loaded = adapter.load()
    if (loaded) {
      setState(loaded)
    }
    // Adopt persisted state once, when the gate opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  useEffect(() => {
    if (!hydrated) {
      return
    }
    adapter.persist(state)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, hydrated])

  const effective = hydrated ? state : initial

  // Spec-drift guard: a persisted step id no longer in the config falls back
  // to the first step.
  const step = config.steps.find((s) => s.id === effective.currentStepId) ?? config.steps[0]

  const value = step ? (effective.answers[step.id] ?? null) : null
  const isFirst = effective.history.length === 0

  const nextId = step ? computeNext(config, effective.answers, step.id) : null
  const hasNext = nextId != null && nextId !== step?.id

  const setAnswer = useCallback((next: unknown) => {
    setState((prev) => ({ ...prev, answers: { ...prev.answers, [prev.currentStepId]: next } }))
  }, [])

  const advance = useCallback(() => {
    setState((prev) => {
      const nid = computeNext(config, prev.answers, prev.currentStepId)
      if (nid == null || nid === prev.currentStepId) {
        return prev
      }
      return { ...prev, currentStepId: nid, history: [...prev.history, prev.currentStepId] }
    })
    options?.onNavigate?.()
  }, [config, options])

  const back = useCallback(() => {
    setState((prev) => {
      if (prev.history.length === 0) {
        return prev
      }
      const history = [...prev.history]
      const previousId = history.pop() as StepId
      return { ...prev, currentStepId: previousId, history }
    })
    options?.onNavigate?.()
  }, [options])

  const reset = useCallback(() => setState(initial), [initial])

  return {
    step: step ?? { id: '', kind: '' },
    value,
    answers: effective.answers,
    isFirst,
    hasNext,
    setAnswer,
    advance,
    back,
    reset,
  }
}
```

- [ ] **Step 2: Type-check and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: clean. (If lint flags the `eslint-disable` comments as unused because the rule name differs, adjust to the rule name lint reports, or lift the load/persist into stable `useCallback`s and add them to deps.)

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/multi-step-flow/hooks/use-step-engine.ts
git commit -m "feat(multi-step-flow): useStepEngine reducer with injected persistence"
```

---

### Task 6: Presentational primitives (`StepProgress`, `CardOption`)

Two small presentational components. `StepProgress` is a de-funnel'd port of `FunnelProgress`. `CardOption` is extracted from the inline card markup in the funnel's `CardSelectStepView`, made asset-agnostic via a `renderAsset` slot (the framework holds no icon registry).

**Files:**
- Create: `src/shared/domains/multi-step-flow/ui/step-progress.tsx`
- Create: `src/shared/domains/multi-step-flow/ui/card-option.tsx`

**Interfaces:**
- Consumes: `CardOption` (type), `OptionAsset` from `../types`; `cn` from `@/shared/lib/utils`; `CARD_STAGGER_ITEM`, `CTA_HOVER`, `CTA_TAP` from `../constants/step-motion`; `motion`, `useReducedMotion` from `motion/react`.
- Produces:
  - `function StepProgress({ total, currentIndex }: { total: number, currentIndex: number })`
  - `function CardOption({ option, selected, columns, onSelect, renderAsset }: { option: CardOptionData, selected: boolean, columns: 1 | 2, onSelect: (id: string) => void, renderAsset?: (asset: OptionAsset) => ReactNode })` — where `CardOptionData` is the `CardOption` type from `../types` (aliased at import to avoid the name clash with the component).

- [ ] **Step 1: Write `ui/step-progress.tsx`**

```tsx
'use client'

import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/shared/lib/utils'
import { STEP_TRANSITION } from '../constants/step-motion'

interface StepProgressProps {
  total: number
  /** 0-based index of the current step. */
  currentIndex: number
}

export function StepProgress({ total, currentIndex }: StepProgressProps) {
  const reduce = useReducedMotion()
  const pct = total > 0 ? Math.min(100, Math.round(((currentIndex + 1) / total) * 100)) : 0

  return (
    <div className={cn('h-1 w-full overflow-hidden rounded-full bg-muted')}>
      <motion.div
        animate={{ width: `${pct}%` }}
        className="h-full rounded-full bg-primary"
        initial={reduce ? false : { width: 0 }}
        transition={STEP_TRANSITION}
      />
    </div>
  )
}
```

> `STEP_TRANSITION` is imported and used here — add it to the import line alongside nothing else from that module. (`bg-primary`/`bg-muted` are theme tokens present in the repo's Tailwind config.)

- [ ] **Step 2: Write `ui/card-option.tsx`**

```tsx
'use client'

import type { ReactNode } from 'react'
import type { CardOption as CardOptionData, OptionAsset } from '../types'
import { motion } from 'motion/react'
import { cn } from '@/shared/lib/utils'
import { CARD_STAGGER_ITEM, CTA_HOVER, CTA_TAP } from '../constants/step-motion'

interface CardOptionProps {
  option: CardOptionData
  selected: boolean
  columns: 1 | 2
  onSelect: (id: string) => void
  /** Optional asset renderer. When absent, only label/description render. */
  renderAsset?: (asset: OptionAsset) => ReactNode
}

export function CardOption({ option, selected, columns, onSelect, renderAsset }: CardOptionProps) {
  return (
    <motion.button
      className={cn(
        'flex items-center gap-3 rounded-xl border p-4 text-left transition-colors',
        columns === 1 ? 'w-full' : 'w-full flex-col items-start',
        selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
      )}
      type="button"
      variants={CARD_STAGGER_ITEM}
      whileHover={CTA_HOVER}
      whileTap={CTA_TAP}
      onClick={() => onSelect(option.id)}
    >
      {option.asset && renderAsset ? renderAsset(option.asset) : null}
      <span className="flex flex-col">
        <span className="font-medium">{option.label}</span>
        {option.description ? <span className="text-sm text-muted-foreground">{option.description}</span> : null}
      </span>
    </motion.button>
  )
}
```

- [ ] **Step 3: Type-check and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/multi-step-flow/ui/step-progress.tsx src/shared/domains/multi-step-flow/ui/card-option.tsx
git commit -m "feat(multi-step-flow): StepProgress + CardOption presentational primitives"
```

---

### Task 7: The slotted shell (`ui/step-shell.tsx`)

The generic landing → steps → terminal scaffold with view crossfade, keyed step transitions, progress, next/back nav, and slots for engine-specific chrome. Owns structure only; every consumer-specific visual is a slot.

**Files:**
- Create: `src/shared/domains/multi-step-flow/ui/step-shell.tsx`

**Interfaces:**
- Consumes: `BaseStep`, `FlowConfig`, `StepProps`, `StepRegistry` from `../types`; `StepEngineApi` from `../hooks/use-step-engine`; `StepProgress` from `./step-progress`; `STEP_TRANSITION`, `STEP_VARIANTS` from `../constants/step-motion`; `RAIL_MAX_W`, `QUESTION_MAX_W` from `../constants/layout`; `Button` from `@/shared/components/ui/button`; `cn` from `@/shared/lib/utils`; `AnimatePresence`, `motion` from `motion/react`.
- Produces: `function StepShell<Step extends BaseStep<string>, Ctx>(props: StepShellProps<Step, Ctx>)` and `interface StepShellProps<Step, Ctx>`.

- [ ] **Step 1: Write the shell**

```tsx
'use client'

import type { ComponentType, ReactNode } from 'react'
import type { StepEngineApi } from '../hooks/use-step-engine'
import type { BaseStep, FlowConfig, StepProps, StepRegistry } from '../types'
import { AnimatePresence, motion } from 'motion/react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { QUESTION_MAX_W, RAIL_MAX_W } from '../constants/layout'
import { STEP_TRANSITION, STEP_VARIANTS } from '../constants/step-motion'
import { StepProgress } from './step-progress'

export interface StepShellProps<Step extends BaseStep<string>, Ctx> {
  engine: StepEngineApi
  config: FlowConfig<Step, Ctx>
  ctx: Ctx
  registry: StepRegistry<string>
  /** Engine-specific chrome slots. All optional; absent slots render nothing. */
  landing?: ReactNode
  terminal?: ReactNode
  header?: ReactNode
  footer?: ReactNode
  background?: ReactNode
  /** Optional per-step wrapper (e.g. question-column chrome). */
  renderStep?: (node: ReactNode, step: BaseStep<string>) => ReactNode
  /** Label overrides for nav buttons. */
  backLabel?: string
  nextLabel?: string
}

export function StepShell<Step extends BaseStep<string>, Ctx>({
  engine,
  config,
  ctx,
  registry,
  landing,
  terminal,
  header,
  footer,
  background,
  renderStep,
  backLabel = 'Back',
  nextLabel = 'Next',
}: StepShellProps<Step, Ctx>) {
  const landingId = config.landingStepId ?? config.steps[0]?.id
  const isLanding = engine.isFirst && engine.step.id === landingId
  const isTerminal = (config.terminalKinds ?? []).includes(engine.step.kind)
  const view: 'landing' | 'steps' | 'terminal' = isLanding ? 'landing' : isTerminal ? 'terminal' : 'steps'

  // The one documented widening at the dispatch seam.
  const StepView = registry[engine.step.kind] as ComponentType<StepProps<any, any, any>>
  const content = (engine.step as { content?: unknown }).content ?? null

  const stepNode: ReactNode = (
    <StepView
      advance={engine.advance}
      answers={engine.answers}
      back={engine.back}
      content={content}
      ctx={ctx}
      isAnswered={engine.value != null}
      isFirst={engine.isFirst}
      setValue={engine.setAnswer}
      step={engine.step}
      value={engine.value}
    />
  )
  const stepEl = renderStep ? renderStep(stepNode, engine.step) : stepNode

  const currentIndex = config.steps.findIndex((s) => s.id === engine.step.id)

  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={view}
        animate={{ opacity: 1 }}
        className="relative min-h-dvh w-full"
        exit={{ opacity: 0 }}
        initial={{ opacity: 0 }}
        transition={STEP_TRANSITION}
      >
        {background}

        {view === 'landing' && (landing ?? stepEl)}

        {view === 'terminal' && (
          <div className={cn('mx-auto w-full px-4', RAIL_MAX_W)}>
            {header}
            {terminal ?? stepEl}
            {footer}
          </div>
        )}

        {view === 'steps' && (
          <div className={cn('mx-auto flex min-h-dvh w-full flex-col px-4', RAIL_MAX_W)}>
            {header}
            <StepProgress currentIndex={currentIndex} total={config.steps.length} />

            <div className="min-h-0 flex-1 overflow-y-auto py-6">
              <div className={cn('mx-auto w-full', QUESTION_MAX_W)}>
                <AnimatePresence initial={false} mode="wait">
                  <motion.div
                    key={engine.step.id}
                    animate="animate"
                    exit="exit"
                    initial="initial"
                    transition={STEP_TRANSITION}
                    variants={STEP_VARIANTS}
                  >
                    {stepEl}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center justify-between py-4">
              <Button disabled={engine.isFirst} variant="outline" onClick={engine.back}>
                {backLabel}
              </Button>
              <Button disabled={!engine.hasNext || engine.value == null} onClick={engine.advance}>
                {nextLabel}
              </Button>
            </div>

            {footer}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
```

> Design notes: landing defaults to rendering the current step (`stepEl`) when no `landing` slot is given — matching the funnel's "first step is the hero-entry" behavior generically. Terminal/steps views wrap in the neutral rail. The `renderStep` slot lets a consumer inject question chrome without the shell knowing about it. No hero/parallax/blueprint-grid here — those are funnel chrome passed via `background`/`header`/`landing` when funnels migrate (deferred).

- [ ] **Step 2: Type-check and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: clean. (Confirm `@/shared/components/ui/button` exports `Button` — it is the shadcn button used by the funnel engine and meeting-flow.)

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/multi-step-flow/ui/step-shell.tsx
git commit -m "feat(multi-step-flow): slotted StepShell (landing/steps/terminal)"
```

---

### Task 8: Reference flow + dev route (the executable smoke-test)

A minimal 4-view flow — landing → text step → card-select step → terminal — wired through `StepShell` with an in-memory adapter, mounted on a dev-only route. This is the plan's proof the generics infer, the engine navigates, persistence round-trips, and transitions render. Not production code; not linked from nav.

**Files:**
- Create: `src/shared/domains/multi-step-flow/example/reference-adapter.ts`
- Create: `src/shared/domains/multi-step-flow/example/reference-flow.tsx`
- Create: `src/app/(frontend)/dev/multi-step-flow/layout.tsx`
- Create: `src/app/(frontend)/dev/multi-step-flow/page.tsx`

**Interfaces:**
- Consumes: everything produced in Tasks 2–7.
- Produces: `createInMemoryAdapter()`, `ReferenceFlow` (client component), and the dev route.

- [ ] **Step 1: Write `example/reference-adapter.ts`**

```ts
import type { EngineState, StepPersistenceAdapter } from '../types'

/**
 * Module-scoped in-memory adapter for the reference flow. Persists across
 * re-renders/remounts within a dev session (no localStorage, no DB). Sync
 * load -> no `useHydration`. NOT for production.
 */
export function createInMemoryAdapter(): StepPersistenceAdapter<EngineState> {
  let snapshot: EngineState | null = null
  return {
    load: () => snapshot,
    persist: (next) => {
      snapshot = next
    },
  }
}
```

- [ ] **Step 2: Write `example/reference-flow.tsx`**

```tsx
'use client'

import type { BaseStep, FlowConfig, StepProps, StepRegistry } from '../types'
import { useMemo, useRef } from 'react'
import { cardOptions, text } from '../lib/card-options'
import { scrollToTop } from '../lib/scroll-to-top'
import { useStepEngine } from '../hooks/use-step-engine'
import { CardOption } from '../ui/card-option'
import { StepShell } from '../ui/step-shell'
import { createInMemoryAdapter } from './reference-adapter'

// --- This consumer's kinds, content, answers, ctx (lockstep, per-engine) ---
type RefKind = 'welcome' | 'name' | 'pick' | 'done'

interface WelcomeStep extends BaseStep<'welcome'> { content: { title: string } }
interface NameStep extends BaseStep<'name'> { content: { title: string } }
interface PickStep extends BaseStep<'pick'> { content: { title: string, options: ReturnType<typeof cardOptions> } }
interface DoneStep extends BaseStep<'done'> { content: { title: string } }
type RefStep = WelcomeStep | NameStep | PickStep | DoneStep

interface RefCtx { flowName: string }

// --- Step components, each authored against its own narrow StepProps ---
function WelcomeStepView({ content, advance }: StepProps<{ title: string }, never, RefCtx>) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-6 text-center">
      <h1 className="text-3xl font-bold">{content.title}</h1>
      <button className="rounded-lg bg-primary px-6 py-3 text-primary-foreground" type="button" onClick={advance}>
        Start
      </button>
    </div>
  )
}

function NameStepView({ content, value, setValue }: StepProps<{ title: string }, string, RefCtx>) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{content.title}</h2>
      <input
        className="rounded-lg border border-border px-4 py-2"
        placeholder="Type anything"
        value={value ?? ''}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  )
}

function PickStepView({ content, value, setValue, advance }: StepProps<PickStep['content'], string, RefCtx>) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{content.title}</h2>
      <div className="flex flex-col gap-3">
        {content.options.map((opt) => (
          <CardOption
            key={opt.id}
            columns={1}
            option={opt}
            selected={value === opt.id}
            onSelect={(id) => {
              setValue(id)
              advance()
            }}
          />
        ))}
      </div>
    </div>
  )
}

function DoneStepView({ content }: StepProps<{ title: string }, never, RefCtx>) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-3xl font-bold">{content.title}</h1>
      <p className="text-muted-foreground">Reference flow complete.</p>
    </div>
  )
}

const REGISTRY: StepRegistry<RefKind> = {
  welcome: WelcomeStepView,
  name: NameStepView,
  pick: PickStepView,
  done: DoneStepView,
}

export function ReferenceFlow() {
  const stageRef = useRef<HTMLDivElement>(null)
  const adapter = useMemo(() => createInMemoryAdapter(), [])

  const config = useMemo<FlowConfig<RefStep, RefCtx>>(() => ({
    steps: [
      { id: 'welcome', kind: 'welcome', content: { title: 'Multi-Step-Flow Reference' } },
      { id: 'name', kind: 'name', content: { title: 'What should we call you?' } },
      {
        id: 'pick',
        kind: 'pick',
        content: {
          title: 'Pick one',
          options: cardOptions([text('a', 'Option A'), text('b', 'Option B'), text('c', 'Option C')]),
        },
      },
      { id: 'done', kind: 'done', content: { title: 'All set 🎉' } },
    ],
    terminalKinds: ['done'],
  }), [])

  const ctx = useMemo<RefCtx>(() => ({ flowName: 'reference' }), [])
  const engine = useStepEngine(config, adapter, { onNavigate: () => scrollToTop(stageRef.current) })

  return (
    <div ref={stageRef}>
      <StepShell config={config} ctx={ctx} engine={engine} registry={REGISTRY as StepRegistry<string>} />
    </div>
  )
}
```

> If tsc rejects the `FlowConfig<RefStep, RefCtx>` literal because `RefCtx` can't be inferred/assigned without the `__ctx` marker, either set `__ctx: undefined as unknown as RefCtx` in the literal or keep the `__ctx` field from Task 2. This is exactly the inference check that validates the `Ctx` type parameter design.

- [ ] **Step 3: Write the dev route layout** (`src/app/(frontend)/dev/multi-step-flow/layout.tsx`)

```tsx
import type { ReactNode } from 'react'

export default function MultiStepFlowDevLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-background text-foreground">{children}</div>
}
```

- [ ] **Step 4: Write the dev route page** (`src/app/(frontend)/dev/multi-step-flow/page.tsx`)

```tsx
import { ReferenceFlow } from '@/shared/domains/multi-step-flow/example/reference-flow'

export default function MultiStepFlowDevPage() {
  return <ReferenceFlow />
}
```

- [ ] **Step 5: Type-check and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: clean. Run `pnpm lint:fix` first if formatting drifts.

- [ ] **Step 6: Manual smoke-test in dev**

```bash
pnpm dev
```

Navigate to `http://localhost:3000/dev/multi-step-flow` and verify:
- Landing renders with a **Start** button; no progress bar or nav.
- Start → the **name** step: progress bar shows ~50%, Back enabled, Next disabled until you type.
- Type text → Next enabled → advance to **pick**; progress ~75%.
- Press **Back** → returns to **name** with your typed text still present (answers persist across back-nav).
- Select an option on **pick** → auto-advances to **done** (terminal): no nav, no progress.
- No first-paint flash/mismatch (hydration gate holds).
- View crossfade + per-step slide transitions render.

- [ ] **Step 7: Commit**

```bash
git add src/shared/domains/multi-step-flow/example "src/app/(frontend)/dev"
git commit -m "feat(multi-step-flow): reference flow + dev-only smoke route"
```

---

### Task 9: README + full-package validation

Document how to build a consumer engine, then run the whole-repo validation gate and the funnels regression check.

**Files:**
- Create: `src/shared/domains/multi-step-flow/README.md`

**Interfaces:**
- Consumes: the whole package.
- Produces: package documentation only.

- [ ] **Step 1: Write `README.md`**

Include these sections (fill with real content, no placeholders):
- **What this is** — a neutral, ordered/branching multi-step flow framework: config + step contract + reducer + injected persistence adapter + slotted shell. No "funnel" coupling.
- **What it is NOT** — it owns no steps, no persistence store, no CSS scopes, no slug registry. Consumers own those.
- **How to build a consumer engine** — the five things a consumer provides, with a short code sketch drawn from `example/reference-flow.tsx`:
  1. its `Kind` union + per-kind content/answer shapes + `Ctx`;
  2. step components authored against narrow `StepProps<Content, Answer, Ctx>`;
  3. a `StepRegistry<Kind>` mapping kind → component;
  4. a `StepPersistenceAdapter<EngineState>` (localStorage sync, or DB async + `useHydration`);
  5. a `FlowConfig` + `useStepEngine(config, adapter, { onNavigate })` rendered through `<StepShell … slots>`.
- **Persistence adapter contract** — the `load` / `persist` / `useHydration` seam and the sync-vs-async hydration note.
- **The one cast** — the dispatch-seam widening in `StepShell`, and why each step stays narrowly typed.
- **`example/` is not production** — manual smoke-test artifact; do not import from production surfaces.

- [ ] **Step 2: Full type-check + lint gate**

```bash
pnpm lint:fix && pnpm tsc && pnpm lint
```

Expected: `tsc` and `lint` both clean across the whole repo.

- [ ] **Step 3: Funnels regression check**

```bash
pnpm dev
```

Load one live funnel (e.g. the kitchens funnel route under `src/app/(frontend)/funnels/[trade]`) and confirm the landing hero, a card-select step, and a marketing block (which render via the relocated `Block`) all display and navigate exactly as before. The only funnel-touching change was the `Block` import path (Task 1), so this is a targeted check for incidental breakage.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/multi-step-flow/README.md
git commit -m "docs(multi-step-flow): package README + consumer-engine guide"
```

---

## Follow-up (non-blocking, opportunistic)

- ⚠️ **Stale ref:** `docs/programs/README.md:83` points to `src/features/meetings/constants/programs.ts`; the code actually lives at `src/features/meeting-flow/constants/programs.ts`. Fix the doc line if touching that area. (Verified during mapping — not part of this plan's deliverable.)

## Deferred to their own spec → plan cycles (NOT in this plan)

1. Applications data model + backend (entity, no `ownerId`, visibility via `userParticipatesInMeeting`, draft–commit split, `application_answers`, `x_application_trades`).
2. TPR Assistance engine + runner (+ Showcase stub) — a real consumer of this package with a DB-autosave adapter.
3. Review queue + approval email (trade-aware incentive catalog brainstormed separately).
4. Funnel migration onto `multi-step-flow` (retire funnel's private engine/shell/motion/progress; add a localStorage adapter). This fully realizes "affect one, affect all."
