# Showcase Funnel — Plan 2a: Engine Core + Step Library Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared, funnel-agnostic multi-step **engine** + the first two reusable **step kinds** (`info`, `card-select`), then drive the kitchen funnel's first three steps (hero → layout → own-or-rent) end-to-end with refresh-resume.

**Architecture:** The engine is shared infrastructure under `src/shared/domains/funnels/`. It consumes a declarative `FunnelSpec` (one per funnel), evaluates `spec.flow(answers)` for navigation/branching, holds `{ currentStepId, history, answers }` in `localStorage` (via the existing `usePersistedState`) for refresh-resume, applies `spec.theme` as inline CSS variables, and dispatches each `spec.steps[i]` to a registered step component by its `kind`. Steps are presentational + props-driven, implementing one shared `StepProps` contract. Adding a funnel = a new spec file; adding a step type = a new entry in the step registry — neither touches the engine.

**Tech Stack:** Next.js 15.5.9 (App Router, `src/`), React 19, TypeScript, `motion` v12, `react-hook-form` + `zod` v4 (later plans), Tailwind v4 + shadcn/ui.

**Specs:**
- `docs/superpowers/specs/2026-06-17-showcase-funnel-system-design.md` — product/UX (§2 flow, §7 non-functional).
- `docs/superpowers/specs/2026-06-18-funnels-domain-config-architecture-design.md` — domain/config architecture (§3 four layers, §4 FunnelSpec, §8 forward-context).

## Precondition (HARD DEPENDENCY — verify before starting)

The **funnels domain/config architecture** must already be implemented (the refactor from the Plan 1 review). Before Task 1, confirm these exist:
- `src/shared/domains/funnels/constants/slugs.ts` exporting `FUNNEL_SLUGS`, `FunnelSlug`, `isFunnelSlug`.
- `src/shared/domains/funnels/types.ts` exporting a `FunnelSpec` skeleton (`slug`, `content`, `theme`, `steps`, `flow`, `pixel`).
- `src/shared/domains/funnels/lib/registry.ts` exporting `getFunnel(slug): FunnelSpec`, backed by a static exhaustive `Record<FunnelSlug, FunnelSpec>` that imports every spec directly. (No `registerFunnel` side-effect — completeness is compile-time-enforced. This supersedes the earlier `registerFunnel` idea; see the foundation plan.)
- `src/shared/domains/funnels/constants/kitchens.ts` (+ `bathrooms.ts`, `complete-interior.ts`) spec **stubs** — each a plain `export const …Funnel: FunnelSpec` (no `registerFunnel` call); the registry's static map references them.
- `src/app/(frontend)/funnels/[trade]/page.tsx` calling `getFunnel(slug)`.

If any are missing, STOP — this plan cannot run until the architecture plan lands. (Run: `ls src/shared/domains/funnels/{constants/slugs.ts,types.ts,lib/registry.ts}` to verify.)

## Global Constraints

- **Named exports only** — never `export default` (except Next.js `page.tsx`/`layout.tsx`).
- **No unit-test runner exists.** Verification = `pnpm tsc` + `pnpm lint` + runtime smoke. Do NOT add vitest/jest.
- **Imports:** external before internal, alphabetical within group (`perfectionist`); named imports alphabetical; this repo wants **top-level `import type`** (not inline `type` specifiers — `import/consistent-type-specifier-style`). Run `pnpm lint:fix` to auto-fix ordering.
- **`if` bodies need braces + newline** (`antfu/if-newline`).
- **Path alias:** `@/` → `src/`.
- **Commit discipline (pathspec only):** `git commit -m "msg" -- <exact paths>`. NEVER `git add -A`/`git add .`/bare `git commit` — `main` carries concurrent work from other sessions. Run `git status --short` before each commit to confirm scope.
- **`shared → features` is forbidden.** All funnel code lives in `shared/domains/funnels/` and imports only `shared/`. Never import from `features/`.
- **Schemas live in `schemas/` as a sibling of `lib/`** (not `lib/schemas/`) — applies in Plan 2b.
- **ONE React component per file. No file-level constants/helpers in component files** (extract to `constants/`/`lib/`). No barrel files in `ui/`, `hooks/`, `lib/`, `constants/`.
- **Engine is trade-agnostic.** No `kitchen`/`bathroom` literals anywhere in `hooks/` or `ui/`. Trade-specific data comes only from the `FunnelSpec`.
- **Motion:** respect `prefers-reduced-motion`; `duration 0.2–0.25`, `ease [0.25,0.1,0.25,1]` (matches `sidebar-motion.ts`).

## File structure (this plan)

```
src/shared/domains/funnels/
├── types.ts                      MODIFY — finalize StepId/FunnelAnswers/FunnelStep/FunnelContent/StepProps
├── constants/
│   ├── storage-keys.ts           CREATE — funnelStateKey(slug) helper
│   └── kitchens.ts               MODIFY — fill hero/layout/homeowner steps + content (linear flow)
├── lib/
│   ├── funnel-motion.ts          CREATE — shared transition + step variants
│   └── step-registry.ts          CREATE — kind → step component map
├── hooks/
│   └── use-funnel-engine.ts      CREATE — engine state machine (nav, branching, persistence)
└── ui/
    ├── funnel-engine.tsx         CREATE — engine shell (theme, progress, AnimatePresence, dispatch)
    ├── funnel-progress.tsx       CREATE — designed progress indicator
    └── steps/
        ├── info-step.tsx         CREATE — hero / informational step (no input)
        └── card-select-step.tsx  CREATE — single-select branded cards
```

Route page (`src/app/(frontend)/funnels/[trade]/page.tsx`) is modified to render `<FunnelEngine spec={spec} />`.

---

### Task 1: Finalize the type contracts (`types.ts`)

**Files:**
- Modify: `src/shared/domains/funnels/types.ts`

**Interfaces:**
- Produces: `StepId`, `FunnelAnswers`, `StepProps`, the `FunnelStep` discriminated union (with `InfoStep`, `CardSelectStep` variants), `FunnelContent`, `FunnelTheme`, and the finalized `FunnelSpec` (extends the architecture stub).

- [ ] **Step 1: Replace the stubbed step/content internals with the finalized contracts**

**Reconcile against the LANDED foundation `types.ts`** (verified 2026-06-18). The foundation defines `FunnelContent = { title, headline, subhead, scarcityLine }`, `FunnelTheme = { accent: string }`, `FunnelStep = { id }`, `FunnelAnswers = Partial<Record<StepId, unknown>>`, `flow: (answers) => StepId | null`, and `FunnelSpec` with inline `pixel: { contentCategory: string }`. Plan 2 fills the "Plan 2 extends this" seams the foundation left:

- **EXTEND** `FunnelContent`: keep the four hero fields; ADD a per-step `steps` map.
- **REPLACE** `FunnelStep` (`{ id }` stub) with the discriminated union.
- **NARROW** `FunnelAnswers` to a `field`-keyed record.
- **ADD** the currentStepId param to `FunnelSpec.flow` (the stubs' `() => null` stay assignable).
- **ADD** `StepContent`/`OptionContent`/`StepProps`/`StepComponent`/`StepKind`.
- **LEAVE** `FunnelTheme = { accent: string }` as-is — per-trade accent tuning is Plan 5; the 2a engine uses the brand default and only stamps `data-funnel={slug}` for later theming.

Apply to `types.ts`:

```ts
import type { ComponentType } from 'react'
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'

/** A step's stable identifier, unique within a funnel. */
export type StepId = string

/** Accumulated answers, keyed by the answering step's `field` (e.g. 'layout',
 *  'ownership', 'zip', 'city'). NARROWS the foundation's Partial<Record<StepId,unknown>>. */
export type FunnelAnswers = Record<string, string | string[] | null>

// ── Step variants (discriminated by `kind`) — REPLACES the `{ id }` stub ──
interface BaseStep { id: StepId }

/** Informational / hero step — no input; a CTA advances. Renders funnel-level hero copy. */
export interface InfoStep extends BaseStep { kind: 'info' }

/** Single-select branded cards. `field` is the answers key; `optionIds` order the cards. */
export interface CardSelectStep extends BaseStep {
  kind: 'card-select'
  field: string
  optionIds: string[]
}

/** The step union. New kinds (location, pii-form, datetime, confirmation) added in 2b/2c. */
export type FunnelStep = InfoStep | CardSelectStep
export type StepKind = FunnelStep['kind']

// ── Per-step content (the lift-to-DB-later seam) ──
export interface OptionContent {
  label: string
  icon?: string
  description?: string
}

export interface StepContent {
  /** Step heading (input steps). The hero ignores this and uses funnel-level copy. */
  title: string
  subtitle?: string
  /** CTA label. */
  cta?: string
  /** card-select: option id → its copy. */
  options?: Record<string, OptionContent>
}

// ── EXTEND the landed FunnelContent: keep the four hero fields, ADD `steps` ──
export interface FunnelContent {
  title: string         // existing — hero + document title
  headline: string      // existing — hero headline
  subhead: string       // existing — hero subhead
  scarcityLine: string  // existing — scarcity line
  steps: Record<StepId, StepContent>  // NEW (Plan 2) — per-step copy
}

// ── Step component contract ──
export interface StepProps<S extends FunnelStep = FunnelStep> {
  step: S
  /** Funnel-level copy — the hero step reads headline/subhead/scarcityLine from here. */
  funnelContent: FunnelContent
  /** Per-step copy (input steps). Undefined for the hero (uses funnelContent). */
  content?: StepContent
  value: string | string[] | null
  onChange: (value: string | string[]) => void
  onAdvance: () => void
  onBack: () => void
  isFirst: boolean
}

export type StepComponent<S extends FunnelStep = FunnelStep> = ComponentType<StepProps<S>>
```

Then update the landed `FunnelSpec.flow` signature in place (leave its other fields and `FunnelTheme` untouched):

```ts
  flow: (answers: FunnelAnswers, currentStepId: StepId) => StepId | null
```

> The foundation's `FunnelStep`, `FunnelContent`, `FunnelAnswers` declarations are REPLACED (same names, new bodies); `FunnelTheme`, `FunnelSpec`'s field list, and the inline `pixel` shape are UNCHANGED.

- [ ] **Step 1b: Keep the sibling stubs valid** — making `FunnelContent.steps` REQUIRED breaks `bathrooms.ts` and `complete-interior.ts` (their `content` has no `steps`). Add `steps: {},` to each stub's `content` (they stay step-less until Plan 4). Commit them together with `types.ts` in Step 3.

- [ ] **Step 2: Type-check**

Run: `pnpm tsc 2>&1 | tail -5`
Expected (after Step 1b): errors ONLY from the engine files that don't exist yet and from `kitchens.ts` (still step-less — reconciled in Task 6). `types.ts`, `bathrooms.ts`, `complete-interior.ts` must be clean. If `types.ts` itself errors, fix it.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(funnels): finalize FunnelStep/FunnelContent/StepProps contracts" -- src/shared/domains/funnels/types.ts src/shared/domains/funnels/constants/bathrooms.ts src/shared/domains/funnels/constants/complete-interior.ts
```

---

### Task 2: Funnel state storage key + motion constants

**Files:**
- Create: `src/shared/domains/funnels/constants/storage-keys.ts`
- Create: `src/shared/domains/funnels/lib/funnel-motion.ts`

**Interfaces:**
- Produces: `funnelStateKey(slug: FunnelSlug): string`; `FUNNEL_TRANSITION`, `STEP_VARIANTS`.

- [ ] **Step 1: Storage key helper** (mirrors the `tri-pros:` prefix convention in `src/shared/constants/storage-keys.ts`)

```ts
// src/shared/domains/funnels/constants/storage-keys.ts
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'

/** localStorage key for a funnel's resumable engine state. */
export function funnelStateKey(slug: FunnelSlug): string {
  return `tri-pros:funnel:${slug}`
}
```

- [ ] **Step 2: Shared motion constants** (matches `src/features/agent-dashboard/constants/sidebar-motion.ts`)

```ts
// src/shared/domains/funnels/lib/funnel-motion.ts

export const FUNNEL_TRANSITION = { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } as const

/** Enter/exit variants for the step swap (used with AnimatePresence mode="wait"). */
export const STEP_VARIANTS = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
} as const
```

- [ ] **Step 3: Type-check + lint + commit**

Run: `pnpm tsc && pnpm lint`
Expected: clean for these files.

```bash
git commit -m "feat(funnels): engine storage key + motion constants" -- src/shared/domains/funnels/constants/storage-keys.ts src/shared/domains/funnels/lib/funnel-motion.ts
```

---

### Task 3: The engine hook (`use-funnel-engine.ts`)

**Files:**
- Create: `src/shared/domains/funnels/hooks/use-funnel-engine.ts`

**Interfaces:**
- Consumes: `FunnelSpec`, `FunnelAnswers`, `StepId` (Task 1); `funnelStateKey` (Task 2); `usePersistedState` (`@/shared/hooks/use-persisted-state`).
- Produces: `useFunnelEngine(spec): FunnelEngine` where
  `FunnelEngine = { step: FunnelStep, value, answers, isFirst, setAnswer(value), advance(), back(), reset() }`.

- [ ] **Step 1: Implement the engine state machine**

State `{ currentStepId, history, answers }` persists to localStorage (resume on refresh). `advance()` evaluates `spec.flow`. `back()` pops history (answers preserved). All trade-agnostic.

```ts
// src/shared/domains/funnels/hooks/use-funnel-engine.ts
import { useCallback, useMemo } from 'react'
import { funnelStateKey } from '@/shared/domains/funnels/constants/storage-keys'
import type { FunnelAnswers, FunnelSpec, FunnelStep, StepId } from '@/shared/domains/funnels/types'
import { usePersistedState } from '@/shared/hooks/use-persisted-state'

interface EngineState {
  currentStepId: StepId
  history: StepId[]
  answers: FunnelAnswers
}

export interface FunnelEngine {
  step: FunnelStep
  value: string | string[] | null
  answers: FunnelAnswers
  isFirst: boolean
  setAnswer: (value: string | string[]) => void
  advance: () => void
  back: () => void
  reset: () => void
}

export function useFunnelEngine(spec: FunnelSpec): FunnelEngine {
  const initial: EngineState = {
    currentStepId: spec.steps[0].id,
    history: [],
    answers: {},
  }
  const [state, setState] = usePersistedState<EngineState>(funnelStateKey(spec.slug), initial)

  const step = useMemo(() => {
    const found = spec.steps.find(s => s.id === state.currentStepId)
    // Spec changed under a resumed state (step id removed) → restart safely.
    return found ?? spec.steps[0]
  }, [spec.steps, state.currentStepId])

  const field = step.kind === 'card-select' ? step.field : null
  const value = field ? (state.answers[field] ?? null) : null

  const setAnswer = useCallback((next: string | string[]) => {
    if (!field) {
      return
    }
    setState(prev => ({ ...prev, answers: { ...prev.answers, [field]: next } }))
  }, [field, setState])

  const advance = useCallback(() => {
    setState((prev) => {
      const nextId = spec.flow(prev.answers, prev.currentStepId)
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
    answers: state.answers,
    isFirst: state.history.length === 0,
    setAnswer,
    advance,
    back,
    reset,
  }
}
```

- [ ] **Step 2: Verify `usePersistedState` signature matches**

Run: `sed -n '1,40p' src/shared/hooks/use-persisted-state.ts`
Confirm it exports `usePersistedState<T>(key, default): [T, setter]` where setter accepts a value OR an updater function. If the setter does NOT accept an updater function, adjust the calls above to compute the next state from the current `state` closure instead of `prev =>`. Note any deviation in the report.

- [ ] **Step 3: Type-check + lint + commit**

Run: `pnpm tsc && pnpm lint`

```bash
git commit -m "feat(funnels): engine state machine hook (nav + branching + resume)" -- src/shared/domains/funnels/hooks/use-funnel-engine.ts
```

---

### Task 4: Step registry + the two foundational steps

**Files:**
- Create: `src/shared/domains/funnels/ui/steps/info-step.tsx`
- Create: `src/shared/domains/funnels/ui/steps/card-select-step.tsx`
- Create: `src/shared/domains/funnels/lib/step-registry.ts`

**Interfaces:**
- Consumes: `StepProps`, `StepKind`, `StepComponent` (Task 1).
- Produces: `InfoStepView`, `CardSelectStepView`, and `STEP_REGISTRY: Record<StepKind, StepComponent>`.

- [ ] **Step 1: `info-step.tsx`** (hero / informational; CTA advances)

The hero reads **funnel-level** copy (`funnelContent.headline/subhead/scarcityLine`); the CTA label comes from the optional per-step `content?.cta`.

```tsx
// src/shared/domains/funnels/ui/steps/info-step.tsx
import { Button } from '@/shared/components/ui/button'
import type { InfoStep, StepProps } from '@/shared/domains/funnels/types'

export function InfoStepView({ funnelContent, content, onAdvance }: StepProps<InfoStep>) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {funnelContent.scarcityLine
        ? <span className="text-primary bg-primary/10 rounded-full px-3 py-1 text-sm font-medium">{funnelContent.scarcityLine}</span>
        : null}
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{funnelContent.headline}</h1>
      {funnelContent.subhead ? <p className="text-muted-foreground max-w-prose">{funnelContent.subhead}</p> : null}
      <Button size="lg" onClick={onAdvance}>{content?.cta ?? 'Continue'}</Button>
    </div>
  )
}
```

- [ ] **Step 2: `card-select-step.tsx`** (single-select branded cards; selecting auto-advances)

```tsx
// src/shared/domains/funnels/ui/steps/card-select-step.tsx
import { Button } from '@/shared/components/ui/button'
import type { CardSelectStep, StepProps } from '@/shared/domains/funnels/types'
import { cn } from '@/shared/lib/utils'

export function CardSelectStepView({ step, content, value, onChange, onAdvance, onBack, isFirst }: StepProps<CardSelectStep>) {
  function handleSelect(optionId: string) {
    onChange(optionId)
    // Micro-commitment: a tap advances immediately.
    onAdvance()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{content?.title ?? ''}</h2>
        {content?.subtitle ? <p className="text-muted-foreground mt-1">{content.subtitle}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {step.optionIds.map((optionId) => {
          const option = content?.options?.[optionId]
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
              {option?.description ? <span className="text-muted-foreground mt-1 block text-sm">{option.description}</span> : null}
            </button>
          )
        })}
      </div>
      {!isFirst ? (
        <div className="flex justify-start">
          <Button variant="ghost" onClick={onBack}>← Back</Button>
        </div>
      ) : null}
    </div>
  )
}
```

> `cn` lives at `@/shared/lib/utils` — verify the path during implementation (`ls src/shared/lib/utils.ts`); adjust the import if the shadcn util is elsewhere.

- [ ] **Step 3: `step-registry.ts`** (kind → component; the generic dispatch table)

```ts
// src/shared/domains/funnels/lib/step-registry.ts
import { CardSelectStepView } from '@/shared/domains/funnels/ui/steps/card-select-step'
import { InfoStepView } from '@/shared/domains/funnels/ui/steps/info-step'
import type { StepComponent, StepKind } from '@/shared/domains/funnels/types'

export const STEP_REGISTRY: Record<StepKind, StepComponent> = {
  'info': InfoStepView as StepComponent,
  'card-select': CardSelectStepView as StepComponent,
}
```

- [ ] **Step 4: Type-check + lint + commit**

Run: `pnpm tsc && pnpm lint`

```bash
git commit -m "feat(funnels): step registry + info & card-select steps" -- src/shared/domains/funnels/ui/steps/info-step.tsx src/shared/domains/funnels/ui/steps/card-select-step.tsx src/shared/domains/funnels/lib/step-registry.ts
```

---

### Task 5: Engine shell + progress indicator

**Files:**
- Create: `src/shared/domains/funnels/ui/funnel-progress.tsx`
- Create: `src/shared/domains/funnels/ui/funnel-engine.tsx`

**Interfaces:**
- Consumes: `useFunnelEngine` (Task 3), `STEP_REGISTRY` (Task 4), `FUNNEL_TRANSITION`/`STEP_VARIANTS` (Task 2), `FunnelSpec` (Task 1).
- Produces: `FunnelEngine` component (`{ spec }: { spec: FunnelSpec }`), `FunnelProgress`.

- [ ] **Step 1: `funnel-progress.tsx`** (designed progress, not a generic counter)

```tsx
// src/shared/domains/funnels/ui/funnel-progress.tsx
import { cn } from '@/shared/lib/utils'

export function FunnelProgress({ total, currentIndex }: { total: number, currentIndex: number }) {
  return (
    <div className="flex w-full gap-1.5" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn('h-1 flex-1 rounded-full transition-colors', i <= currentIndex ? 'bg-primary' : 'bg-border')}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: `funnel-engine.tsx`** (theme, progress, animated step swap, generic dispatch)

```tsx
// src/shared/domains/funnels/ui/funnel-engine.tsx
'use client'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useFunnelEngine } from '@/shared/domains/funnels/hooks/use-funnel-engine'
import { FUNNEL_TRANSITION, STEP_VARIANTS } from '@/shared/domains/funnels/lib/funnel-motion'
import { STEP_REGISTRY } from '@/shared/domains/funnels/lib/step-registry'
import { getFunnel } from '@/shared/domains/funnels/lib/registry'
import { FunnelProgress } from '@/shared/domains/funnels/ui/funnel-progress'
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'

// IMPORTANT: takes `slug`, NOT `spec`. FunnelSpec contains `flow` (a function),
// which cannot be passed as a prop from the Server-Component route page to this
// Client Component (Next.js forbids non-serializable props). The engine resolves
// the spec from the registry on the client instead.
export function FunnelEngine({ slug }: { slug: FunnelSlug }) {
  const spec = getFunnel(slug)
  const engine = useFunnelEngine(spec)
  const reduceMotion = useReducedMotion()

  const StepView = STEP_REGISTRY[engine.step.kind]
  const stepContent = spec.content.steps[engine.step.id]  // undefined for the hero (uses funnelContent)
  const currentIndex = spec.steps.findIndex(s => s.id === engine.step.id)

  // `data-funnel` is stamped for later per-trade theming (Plan 5); the 2a
  // engine uses the brand default tokens and injects no custom colors
  // (FunnelTheme is just `{ accent: string }` today).
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
            funnelContent={spec.content}
            content={stepContent}
            value={engine.value}
            onChange={engine.setAnswer}
            onAdvance={engine.advance}
            onBack={engine.back}
            isFirst={engine.isFirst}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 3: Type-check + lint + commit**

Run: `pnpm tsc && pnpm lint`

```bash
git commit -m "feat(funnels): engine shell + progress (theme, animated step dispatch)" -- src/shared/domains/funnels/ui/funnel-engine.tsx src/shared/domains/funnels/ui/funnel-progress.tsx
```

---

### Task 6: Kitchen spec (first three steps) + render it

**Files:**
- Modify: `src/shared/domains/funnels/constants/kitchens.ts`
- Modify: `src/app/(frontend)/funnels/[trade]/page.tsx`

**Interfaces:**
- Consumes: `FunnelSpec` (architecture), `FunnelEngine` (Task 5).
- Produces: a kitchen spec with `info` + two `card-select` steps and a linear `flow`, resolvable via the registry's static map.

- [ ] **Step 1: Fill the kitchen spec (hero → layout → own/rent), linear flow**

**EXTEND** the landed `kitchens.ts` stub — keep its existing `content` hero fields (`title`/`headline`/`subhead`/`scarcityLine`) and `theme: { accent: 'primary' }`; ADD the `steps` array, `flow`, `STEP_ORDER`, and the `content.steps` map. It stays a plain `export const kitchensFunnel` (the registry's static map references it). Remaining steps (location, pii, enrichment, datetime, confirmation) arrive in Plans 2b/2c.

```ts
// src/shared/domains/funnels/constants/kitchens.ts
import type { FunnelSpec, StepId } from '@/shared/domains/funnels/types'

const STEP_ORDER: StepId[] = ['hero', 'layout', 'ownership']

export const kitchensFunnel: FunnelSpec = {
  slug: 'kitchens',
  theme: { accent: 'primary' },              // unchanged from foundation; Plan 5 tunes per-trade accent
  pixel: { contentCategory: 'kitchen' },
  steps: [
    { id: 'hero', kind: 'info' },
    { id: 'layout', kind: 'card-select', field: 'layout', optionIds: ['l-shape', 'u-shape', 'galley', 'island', 'open', 'not-sure'] },
    { id: 'ownership', kind: 'card-select', field: 'ownership', optionIds: ['own', 'rent'] },
  ],
  // Linear for kitchen; engine supports branching for other funnels.
  flow: (_answers, currentStepId) => {
    const i = STEP_ORDER.indexOf(currentStepId)
    return i >= 0 && i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1] : null
  },
  content: {
    // ── existing hero fields (keep the foundation's copy) ──
    title: 'Kitchen Showcase',
    headline: 'Get a AAA-grade kitchen remodel — at a Showcase price.',
    subhead: 'See if your home qualifies for one of our Showcase kitchens.',
    scarcityLine: 'We’re selecting 5 kitchens in your area.',
    // ── per-step copy (NEW) ──
    steps: {
      // Hero copy comes from the funnel-level fields above; this entry only
      // supplies the hero CTA label.
      hero: { title: 'Kitchen Showcase', cta: 'See if my kitchen qualifies →' },
      layout: {
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
      ownership: {
        title: 'Do you own or rent your home?',
        subtitle: 'Showcase projects are available to homeowners.',
        options: {
          own: { label: 'I own my home' },
          rent: { label: 'I rent' },
        },
      },
    },
  },
}
```

- [ ] **Step 2: Render the engine from the route page**

The architecture left the page validating the slug + calling `getFunnel`. Replace its placeholder body with the engine:

```tsx
// src/app/(frontend)/funnels/[trade]/page.tsx
import { notFound } from 'next/navigation'
import { isFunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import { FunnelEngine } from '@/shared/domains/funnels/ui/funnel-engine'

interface Props {
  params: Promise<{ trade: string }>
}

export default async function FunnelTradePage({ params }: Props) {
  const { trade } = await params
  if (!isFunnelSlug(trade)) {
    notFound()
  }
  // Pass the SLUG, not the spec — the spec holds a `flow` function that can't
  // cross the server→client boundary. FunnelEngine resolves the spec itself.
  return <FunnelEngine slug={trade} />
}
```

> The page passes `slug` only. The engine calls `getFunnel(slug)` client-side. (Plan 3 may add a server-side `generateMetadata` here that DOES call `getFunnel(trade)` for `<title>`/OG tags — that's fine; the server just can't pass the resolved spec *as a prop* to the client engine.)

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 4: Runtime smoke — kitchen funnel runs + resumes**

Start dev (`pnpm dev`), then in a browser (so localStorage works) — or document the manual steps if no browser is available:
1. Visit `http://kitchens.localhost:3000/` → hero renders with the headline + CTA.
2. Click CTA → layout card-select renders (6 cards).
3. Click a layout card → auto-advances to own/rent.
4. Click **Back** → returns to layout with the prior card still selected (answer preserved).
5. Advance to own/rent, then **refresh the page** → funnel resumes on own/rent (not the hero). This proves `usePersistedState` resume.
6. `curl -s -o /dev/null -w "%{http_code}" -H "Host: kitchens.localhost:3000" http://127.0.0.1:3000/` → `200`.

Record results (and, if no browser, the exact manual steps a human runs) in the report.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(funnels): kitchen spec (hero/layout/ownership) + render engine" -- src/shared/domains/funnels/constants/kitchens.ts "src/app/(frontend)/funnels/[trade]/page.tsx"
```

---

## Out of scope for Plan 2a (later plans)

- `pii-form` step, lead-source seed, `createFromIntake` wiring, UTM capture — **Plan 2b**.
- `location` (ZIP + async-check + stylized SVG region map), enrichment card-selects, `datetime`, `confirmation` (portfolio before/afters) — **Plan 2c**.
- Pixel/CAPI — **Plan 3**. Bathroom/complete-interior specs — **Plan 4**. Visual polish, trade icons, per-trade accent tuning — **Plan 5**.

## Self-Review

- **Spec coverage:** shared funnel-agnostic engine (Tasks 3,5) ✅ [arch §8]; reusable step library + `Step` contract (Tasks 1,4) ✅ [arch §8]; nav back/forward with answers preserved (Task 3 `back`) ✅ [product §7.2]; persistence + refresh-resume via `usePersistedState` (Tasks 2,3) ✅ [product §7.3]; branching evaluated from `spec.flow` (Task 3 `advance`) ✅ [arch §4]; content seam (FunnelContent separate from steps, Task 1) ✅ [arch §3]; per-trade theme inline CSS vars (Task 5) ✅; motion + reduced-motion (Tasks 2,5) ✅ [product §7.1]; designed progress (Task 5) ✅ [product §7.5]. Deferred-with-note: pixel/UTM (§5/§6 → 2b/3), the remaining step kinds (2b/2c).
- **Placeholder scan:** none — every step has concrete code/commands. Theme oklch + remaining steps are explicitly scoped to later plans, not placeholders.
- **Type consistency:** `StepProps`/`FunnelStep`/`FunnelContent`/`StepId` (Task 1) consumed identically in Tasks 3–6; `STEP_REGISTRY` keys are `StepKind` (Task 4) matching the union (Task 1); engine passes exactly the `StepProps` fields the step components destructure; `funnelStateKey`/`FUNNEL_TRANSITION`/`STEP_VARIANTS` (Task 2) used in Tasks 3,5.
- **Dependency flagged:** Task-0 precondition requires the foundation plan landed; the registry is a static `Record<FunnelSlug, FunnelSpec>` (no `registerFunnel`), so specs need only be exported and listed in the map.
