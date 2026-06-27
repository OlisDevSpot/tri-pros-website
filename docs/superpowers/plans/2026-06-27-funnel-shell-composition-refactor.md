# Funnel Shell Composition Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the funnel engine's imperative `let body` 3-way view branch with named view components + a single hoisted footer mount, so adding future views/funnels is declarative and low-risk.

**Architecture:** Extract `FunnelStepNav`, `FunnelStepsView`, and `FunnelConfirmationView` (one component per file, named exports). The engine's `return` becomes a declarative ternary switch over `view`, with `<FunnelFooter ctx={ctx} />` authored ONCE inside the boundary `motion.div` (after the view element) — preserving the current scroll/peek behavior while collapsing three footer call sites to one. Move the `renderBlock` helper out of `funnel-landing.tsx` into `lib/`. This is a **behavior-preserving refactor** — the rendered output and animations must be identical.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4, motion/react.

## Global Constraints

- **Behavior-preserving refactor.** The three views (landing, steps, confirmation) must render and animate EXACTLY as before on both kitchens and bathrooms funnels. Markup/classes move verbatim; only their *location* (which file) changes.
- **Footer placement decision (do NOT deviate):** `<FunnelFooter ctx={ctx} />` is authored ONCE, INSIDE the boundary `motion.div`, AFTER the view element — NOT outside the `AnimatePresence`/`motion.div`. Mounting it outside would push it below a `min-h-dvh` box and break the ~50%-visible footer peek on step pages.
- **Preserve (do NOT touch):** the `useScroll`-driven sticky header owned by `FunnelLanding` (a real motion-lifecycle constraint — landing keeps its OWN `<FunnelStickyHeader>`); the inner step `AnimatePresence` (moves into `FunnelStepsView` unchanged); the outer opacity-only boundary crossfade (avoids trapping the fixed header); `FUNNEL_RAIL_MAX_W` as the rail constant; `ctx` as the ambient bus. No compound-component/slot system, no Context for the width.
- **No unit-test runner exists.** Verify every task with `pnpm tsc` + `pnpm lint`. Task 3 also requires a manual browser pass. NEVER run `pnpm build` or `pnpm db:push`.
- **Work on `main`** (the user works directly on main). `funnel-engine.tsx` and `funnel-landing.tsx` are currently fully committed (no uncommitted WIP) — keep it that way: stage ONLY the files each task names (`git add <file>`), never `git add -A`. Commit each task separately. End every commit message with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Conventions:** ONE React component per file; named exports only (no default export); no barrel files in `ui/`; `shared/` never imports from `features/`; standalone helper functions live in `lib/`, not component files. After moving code OUT of a file, remove any now-unused imports (lint will flag them).
- **Key types/signatures (already in the codebase):**
  - `FunnelEngineApi` (from `@/shared/domains/funnels/hooks/use-funnel-engine`): `{ step: FunnelStep, value: AnswerValue, answers, isFirst, hasNext, setAnswer, advance, back, reset }`.
  - `FunnelStickyHeader` props: `{ opacity: MotionValue<number>, widthClass?: string }` (Task 1 makes `widthClass` required).
  - `FUNNEL_RAIL_MAX_W` from `@/shared/domains/funnels/constants/funnel-layout`.
  - `STEP_VARIANTS`, `FUNNEL_TRANSITION` from `@/shared/domains/funnels/constants/funnel-motion`.

---

### Task 1: Make `FunnelStickyHeader.widthClass` required

**Files:**
- Modify: `src/shared/domains/funnels/ui/funnel-sticky-header.tsx` (line 21)

**Interfaces:**
- Produces: `FunnelStickyHeader` now requires `widthClass: string` (no default). All current callers already pass it (`funnel-engine.tsx` ×2, `funnel-landing.tsx` ×1), so this is safe.

- [ ] **Step 1: Remove the default**

Change the component signature (line 21) from:

```tsx
export function FunnelStickyHeader({ opacity, widthClass = 'max-w-xl' }: { opacity: MotionValue<number>, widthClass?: string }) {
```

to:

```tsx
export function FunnelStickyHeader({ opacity, widthClass }: { opacity: MotionValue<number>, widthClass: string }) {
```

- [ ] **Step 2: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. (tsc confirms every call site passes `widthClass`; if any errors about a missing `widthClass` prop appear, a caller was relying on the default — fix that caller to pass `FUNNEL_RAIL_MAX_W`, but none should.)

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/funnels/ui/funnel-sticky-header.tsx
git commit -m "refactor(funnels): make FunnelStickyHeader widthClass required (fail-fast on misalignment)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Extract `FunnelStepNav`

**Files:**
- Create: `src/shared/domains/funnels/ui/funnel-step-nav.tsx`
- Modify: `src/shared/domains/funnels/ui/funnel-engine.tsx` (the steps branch nav block + imports)

**Interfaces:**
- Produces: `FunnelStepNav({ engine }: { engine: FunnelEngineApi })` — renders the Back/Next cluster, or `null` when `!engine.hasNext`.
- Consumes: `FunnelEngineApi` from the engine hook.

- [ ] **Step 1: Create the nav component**

Create `src/shared/domains/funnels/ui/funnel-step-nav.tsx` with the EXACT markup currently inlined in the engine steps branch:

```tsx
import type { FunnelEngineApi } from '@/shared/domains/funnels/hooks/use-funnel-engine'
import { Button } from '@/shared/components/ui/button'

/**
 * Back / Next cluster under the question stage. Extracted from the engine so the
 * steps view stays declarative and future nav variants (X-close, step counter)
 * have one home. Renders nothing when there is no next step.
 */
export function FunnelStepNav({ engine }: { engine: FunnelEngineApi }) {
  if (!engine.hasNext) {
    return null
  }
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      <Button variant="ghost" onClick={engine.back}>← Back</Button>
      {/* Next stays available for ANY answered step (uniform rule). On card-select
          a tap also advances, but Next is the no-re-tap path for a Back-revisiting
          user who's keeping their answer. */}
      {engine.value != null
        ? <Button onClick={engine.advance}>Next →</Button>
        : <span />}
    </div>
  )
}
```

- [ ] **Step 2: Wire it into the engine steps branch**

In `src/shared/domains/funnels/ui/funnel-engine.tsx`, in the `else` (steps) branch, replace the inline nav block:

```tsx
          {/* ③ Nav — directly under the stage at a constant Y. */}
          {engine.hasNext
            ? (
                <div className="mt-6 flex items-center justify-between gap-3">
                  <Button variant="ghost" onClick={engine.back}>← Back</Button>
                  {engine.value != null
                    ? <Button onClick={engine.advance}>Next →</Button>
                    : <span />}
                </div>
              )
            : null}
```

with:

```tsx
          {/* ③ Nav — directly under the stage at a constant Y. */}
          <FunnelStepNav engine={engine} />
```

Add the import alongside the other `ui/` imports (antfu import order — place it correctly among the `funnel-*` imports):

```tsx
import { FunnelStepNav } from '@/shared/domains/funnels/ui/funnel-step-nav'
```

If `Button` is no longer referenced anywhere else in `funnel-engine.tsx`, remove its import (`import { Button } from '@/shared/components/ui/button'`). Verify with a grep for `Button` in the file before removing.

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS, no unused-import warnings for `funnel-engine.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/funnels/ui/funnel-step-nav.tsx src/shared/domains/funnels/ui/funnel-engine.tsx
git commit -m "refactor(funnels): extract FunnelStepNav from the engine steps branch

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Extract step + confirmation views, declarative switch, single footer mount

**Files:**
- Create: `src/shared/domains/funnels/ui/funnel-steps-view.tsx`
- Create: `src/shared/domains/funnels/ui/funnel-confirmation-view.tsx`
- Modify: `src/shared/domains/funnels/ui/funnel-engine.tsx` (replace `let body` + the `return`; drop `contentWidth`; trim imports)
- Modify: `src/shared/domains/funnels/ui/funnel-landing.tsx` (remove its `<FunnelFooter>` mount + now-unused import)

**Interfaces:**
- Consumes: `FunnelStepNav` (Task 2); `FunnelStickyHeader` required `widthClass` (Task 1); `FunnelEngineApi`; `FunnelSpec`; `FUNNEL_RAIL_MAX_W`; `STEP_VARIANTS`, `FUNNEL_TRANSITION`.
- Produces:
  - `FunnelStepsView({ spec, engine, stepEl, currentIndex, stickyOpacity, reduceMotion })`
  - `FunnelConfirmationView({ stepEl, stickyOpacity })`

- [ ] **Step 1: Create `FunnelStepsView`**

Create `src/shared/domains/funnels/ui/funnel-steps-view.tsx`. This is the engine's CURRENT steps-branch markup moved verbatim (including the `overscroll-y-contain` stage and `FunnelStepNav`):

```tsx
import type { MotionValue } from 'motion/react'
import type { ReactNode } from 'react'
import type { FunnelEngineApi } from '@/shared/domains/funnels/hooks/use-funnel-engine'
import type { FunnelSpec } from '@/shared/domains/funnels/types'
import { AnimatePresence, motion } from 'motion/react'
import { FUNNEL_RAIL_MAX_W } from '@/shared/domains/funnels/constants/funnel-layout'
import { FUNNEL_TRANSITION, STEP_VARIANTS } from '@/shared/domains/funnels/constants/funnel-motion'
import { FunnelProgress } from '@/shared/domains/funnels/ui/funnel-progress'
import { FunnelStepNav } from '@/shared/domains/funnels/ui/funnel-step-nav'
import { FunnelStickyHeader } from '@/shared/domains/funnels/ui/funnel-sticky-header'

/**
 * The interior question view: decoupled progress / fixed-height question stage /
 * nav, with the shared footer rendered by the engine below this cluster. The
 * cluster takes its natural height (no `min-h-dvh`) so the footer follows it and
 * the page scrolls. The inner AnimatePresence owns the question→question swap;
 * the engine's boundary AnimatePresence owns view→view crossfades.
 */
export function FunnelStepsView({ spec, engine, stepEl, currentIndex, stickyOpacity, reduceMotion }: {
  spec: FunnelSpec
  engine: FunnelEngineApi
  stepEl: ReactNode
  currentIndex: number
  stickyOpacity: MotionValue<number>
  reduceMotion: boolean | null
}) {
  return (
    <>
      <FunnelStickyHeader opacity={stickyOpacity} widthClass={FUNNEL_RAIL_MAX_W} />
      <div className={`mx-auto flex w-full flex-col px-5 pb-10 pt-16 ${FUNNEL_RAIL_MAX_W}`}>
        {/* ① Progress — pinned at the top. */}
        <FunnelProgress total={spec.steps.length} currentIndex={currentIndex} />

        {/* ② Question stage — FIXED-height frame; content scrolls INTERNALLY.
            `overscroll-y-contain`: the stage is a nested scroller and the page now
            scrolls too (footer below). Contain keeps the stage's overscroll from
            chaining to the document, so touch devices don't fight over the gesture. */}
        <div className="mt-6 h-[clamp(21rem,56dvh,36rem)] overflow-x-clip overflow-y-auto overscroll-y-contain">
          <div className="overflow-clip">
            <AnimatePresence mode="wait">
              <motion.div
                key={engine.step.id}
                initial={reduceMotion ? false : STEP_VARIANTS.initial}
                animate={STEP_VARIANTS.animate}
                exit={reduceMotion ? undefined : STEP_VARIANTS.exit}
                transition={FUNNEL_TRANSITION}
                className="w-full py-2"
              >
                {stepEl}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ③ Nav — directly under the stage at a constant Y. */}
        <FunnelStepNav engine={engine} />
      </div>
    </>
  )
}
```

- [ ] **Step 2: Create `FunnelConfirmationView`**

Create `src/shared/domains/funnels/ui/funnel-confirmation-view.tsx` — the engine's current confirmation-branch markup (minus the footer, which the engine now mounts):

```tsx
import type { MotionValue } from 'motion/react'
import type { ReactNode } from 'react'
import { FUNNEL_RAIL_MAX_W } from '@/shared/domains/funnels/constants/funnel-layout'
import { FunnelStickyHeader } from '@/shared/domains/funnels/ui/funnel-sticky-header'

/**
 * The terminal confirmation view: reads like the hero/landing (full page height,
 * document scroll), not a question — no progress bar or nav. The shared footer is
 * rendered by the engine below this.
 */
export function FunnelConfirmationView({ stepEl, stickyOpacity }: {
  stepEl: ReactNode
  stickyOpacity: MotionValue<number>
}) {
  return (
    <>
      <FunnelStickyHeader opacity={stickyOpacity} widthClass={FUNNEL_RAIL_MAX_W} />
      <div className={`mx-auto w-full ${FUNNEL_RAIL_MAX_W} px-5 pb-16 pt-20`}>
        {stepEl}
      </div>
    </>
  )
}
```

- [ ] **Step 3: Rewire the engine — declarative switch + single footer mount, drop `contentWidth`**

In `src/shared/domains/funnels/ui/funnel-engine.tsx`:

(a) Delete the `contentWidth` alias + its comment (currently around lines 73–76):

```tsx
  // One content rail for the whole funnel (see constants/funnel-layout). Every
  // step + the terminal confirmation share this baseline width; the sticky
  // header mirrors it. Focused controls constrain internally.
  const contentWidth = FUNNEL_RAIL_MAX_W
```

(b) Delete the ENTIRE `let body: ReactNode` block and its three branches (the `if (view === 'landing') {...} else if (view === 'confirmation') {...} else {...}` — currently ~lines 102–175), AND the existing `return (...)` that wraps `{body}` (~lines 184–198). Replace all of it with this single declarative return:

```tsx
  // Boundary crossfade between views. OPACITY only: unlike a transform it does
  // NOT establish a containing block, so the fixed sticky header keeps anchoring
  // to the viewport through the fade. mode="wait" → the two full-height views
  // never stack (which would double page height and jump the scroll).
  //
  // The view key must stay STABLE within the steps branch (it's the literal
  // 'steps' for every question), or a step→step change would trigger a full-page
  // boundary crossfade instead of the inner stage swap.
  //
  // FunnelFooter is authored ONCE here, inside the boundary motion.div after the
  // view, so all views share a single footer mount while keeping the current
  // scroll/peek behavior (mounting it outside the min-h-dvh box would push it
  // fully below the fold on step pages).
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={view}
        data-funnel={spec.slug}
        className="min-h-dvh w-full"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        transition={FUNNEL_TRANSITION}
      >
        {view === 'landing'
          ? (
              <FunnelLanding spec={spec} ctx={ctx} variant={variant} scrollToQuestionOnMount={engine.value != null}>{heroEntry}</FunnelLanding>
            )
          : view === 'confirmation'
            ? (
                <FunnelConfirmationView stepEl={stepEl} stickyOpacity={stickyOpacity} />
              )
            : (
                <FunnelStepsView
                  spec={spec}
                  engine={engine}
                  stepEl={stepEl}
                  currentIndex={currentIndex}
                  stickyOpacity={stickyOpacity}
                  reduceMotion={reduceMotion}
                />
              )}
        <FunnelFooter ctx={ctx} />
      </motion.div>
    </AnimatePresence>
  )
```

Keep the `view` computation (`const view = engine.isFirst ? 'landing' : engine.step.kind === 'confirmation' ? 'confirmation' : 'steps'`) and `heroEntry`, `stepEl`, `currentIndex`, `ctx`, `stickyOpacity` as they are.

(c) Add the two new imports (antfu order, among the `funnel-*` ui imports):

```tsx
import { FunnelConfirmationView } from '@/shared/domains/funnels/ui/funnel-confirmation-view'
import { FunnelStepsView } from '@/shared/domains/funnels/ui/funnel-steps-view'
```

(d) Remove now-unused imports from `funnel-engine.tsx`. After this change the engine no longer directly uses `AnimatePresence`? — it STILL uses `AnimatePresence` + `motion` for the boundary, and `FUNNEL_TRANSITION`. But it NO LONGER uses: `STEP_VARIANTS` (moved to steps view), `FunnelProgress` (moved), `FunnelStickyHeader` (moved into both views), `FUNNEL_RAIL_MAX_W` (views import it themselves), and `FunnelStepNav` (moved into steps view). Grep each symbol in the file; remove any with zero remaining references. Keep `AnimatePresence`, `motion`, `useMotionValue`, `useReducedMotion`, `useMemo`, `FUNNEL_TRANSITION`, `FunnelFooter`, `FunnelLanding`, `FunnelHeroEntry`, `STEP_REGISTRY`, the hooks, `getFunnel`, `Button`? (Button was already removed in Task 2.) Let `pnpm lint` be the authority on unused imports and fix all it reports.

- [ ] **Step 4: Remove the footer from `FunnelLanding`**

In `src/shared/domains/funnels/ui/funnel-landing.tsx`:
- Delete the `<FunnelFooter ctx={ctx} />` line (the last child of the entrance `motion.div`, after the `FOOTER_CTA_LABEL` `FunnelCta`).
- Remove the now-unused import `import { FunnelFooter } from '@/shared/domains/funnels/ui/footer/funnel-footer'`.

(The landing's footer is now supplied by the engine, which renders `<FunnelLanding/>` then `<FunnelFooter/>` as siblings inside the boundary `motion.div`.)

- [ ] **Step 5: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS, zero unused-import warnings in `funnel-engine.tsx` and `funnel-landing.tsx`.

- [ ] **Step 6: Manual browser verification (behavior-preserving)**

Run `pnpm dev`. On BOTH `kitchens.localhost:3000` and `bathrooms.localhost:3000`, confirm identical-to-before behavior:
- **Landing:** hero + scroll-driven sticky header reveal still works; marketing blocks render; footer at the very bottom (one mount).
- **Steps (card-select / zip / address):** progress + fixed question stage + Back/Next nav unchanged; footer below the cluster; step→step swaps animate via the inner stage (NOT a full-page crossfade); the stage scrolls internally without dragging the page.
- **PII step:** footer legal block still peeks into the fold; page scrolls to reveal it.
- **Confirmation:** full-height scroll view + footer.
- **Transitions:** landing→Q2 and last-question→confirmation still crossfade; the fixed sticky header stays anchored through fades.
If any view differs from before, the markup move was not verbatim — diff against the previous engine branch and fix.

- [ ] **Step 7: Commit**

```bash
git add src/shared/domains/funnels/ui/funnel-steps-view.tsx src/shared/domains/funnels/ui/funnel-confirmation-view.tsx src/shared/domains/funnels/ui/funnel-engine.tsx src/shared/domains/funnels/ui/funnel-landing.tsx
git commit -m "refactor(funnels): declarative view switch + single footer mount in the engine

Extract FunnelStepsView and FunnelConfirmationView; replace the imperative let-body
3-way branch with a declarative switch; hoist FunnelFooter to one mount inside the
boundary motion.div; drop the contentWidth alias. Behavior-preserving.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Move `renderBlock` out of the landing component file

**Files:**
- Create: `src/shared/domains/funnels/lib/render-block.tsx`
- Modify: `src/shared/domains/funnels/ui/funnel-landing.tsx` (remove the local helper, import it)

**Interfaces:**
- Produces: `renderBlock(block: MarketingBlock, ctx: FunnelContext): ReactNode` in `lib/`.
- Note: the current helper has a third `_index` param that is unused — drop it in the move.

- [ ] **Step 1: Create the lib module**

The current helper in `funnel-landing.tsx` is:

```tsx
function renderBlock(block: MarketingBlock, ctx: FunnelContext, _index: number) {
  // Re-narrow per kind: the registry is typed per kind; indexing by the union
  // widens the lookup, so cast through the per-kind content like the step seam.
  const Block = MARKETING_REGISTRY[block.kind] as (props: { content: typeof block.content, ctx: FunnelContext }) => ReactNode
  return <Block content={block.content} ctx={ctx} />
}
```

Create `src/shared/domains/funnels/lib/render-block.tsx` (`.tsx` because it returns JSX) with the helper, dropping the unused `_index`:

```tsx
import type { ReactNode } from 'react'
import type { FunnelContext, MarketingBlock } from '@/shared/domains/funnels/types'
import { MARKETING_REGISTRY } from '@/shared/domains/funnels/constants/marketing-registry'

/**
 * Render one marketing block. Re-narrow per kind: the registry is typed per kind;
 * indexing by the union widens the lookup, so cast through the per-kind content
 * like the step-registry seam in the engine.
 */
export function renderBlock(block: MarketingBlock, ctx: FunnelContext): ReactNode {
  const Block = MARKETING_REGISTRY[block.kind] as (props: { content: typeof block.content, ctx: FunnelContext }) => ReactNode
  return <Block content={block.content} ctx={ctx} />
}
```

- [ ] **Step 2: Update `funnel-landing.tsx`**

- Delete the local `function renderBlock(...) {...}` definition.
- Add the import (antfu order, among the funnel `lib`/`ui` imports):

```tsx
import { renderBlock } from '@/shared/domains/funnels/lib/render-block'
```

- Update the call site (currently `{renderBlock(block, ctx, i)}` inside the `blocks.map`) to drop the index arg:

```tsx
              {renderBlock(block, ctx)}
```

- Remove now-unused imports from `funnel-landing.tsx`: `MARKETING_REGISTRY` (moved), and `MarketingBlock` / `FunnelContext` *type* imports IF they're no longer referenced elsewhere in the file (they likely still are — `FunnelSpec`/`FunnelContext` appear in the component's prop types and `MarketingBlock` may not). Let `pnpm lint` flag unused imports and remove exactly those.

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS, no unused imports in `funnel-landing.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/funnels/lib/render-block.tsx src/shared/domains/funnels/ui/funnel-landing.tsx
git commit -m "refactor(funnels): move renderBlock helper to lib/ (repo convention)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (from the approved design + agent-1 audit):**
- Extract `FunnelStepNav` → Task 2. ✓
- Extract `FunnelStepsView` + `FunnelConfirmationView` → Task 3. ✓
- Declarative view switch replacing `let body` → Task 3. ✓
- Single footer mount (inside boundary motion.div, after view) → Task 3. ✓
- Remove footer from `FunnelLanding` + both engine branches → Task 3. ✓
- Drop `contentWidth` alias → Task 3 Step 3(a). ✓
- Make `widthClass` required → Task 1. ✓
- Move `renderBlock` to `lib/` → Task 4. ✓
- Preserve useScroll-in-landing header, inner AnimatePresence, outer opacity crossfade, FUNNEL_RAIL_MAX_W, ctx → enforced in Global Constraints + verbatim markup moves. ✓

**Placeholder scan:** No TBDs; every code step shows complete code. Verification is tsc + lint + a manual browser pass (no unit-test runner). ✓

**Type consistency:** `FunnelStepNav({ engine: FunnelEngineApi })`, `FunnelStepsView({ spec, engine, stepEl, currentIndex, stickyOpacity, reduceMotion })`, `FunnelConfirmationView({ stepEl, stickyOpacity })`, `renderBlock(block, ctx)` — names/signatures consistent across the tasks that produce and consume them. `stickyOpacity` typed `MotionValue<number>` everywhere; `reduceMotion` typed `boolean | null` (matches `useReducedMotion()`'s return). ✓
