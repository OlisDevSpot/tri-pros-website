# Funnel Engine — Phase 1: Reusability Core (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an open, type-safe escape hatch so a funnel can inject fully-custom blocks and steps inline (no global union/registry edits), add a type-safe `configureStep` override helper, and make the shared `reviews` block honor per-funnel content.

**Architecture:** Layer an *open* injection path on top of the existing *closed, typed* registries. A new `CustomBlock` / `CustomStep` discriminated-union arm carries its own component inline; the two render dispatch seams (`funnel-landing.tsx`, `funnel-engine.tsx`) branch on `kind === 'custom'` to render the inline component, otherwise fall through to the existing registry lookup. Shared blocks/steps are untouched. No runtime behavior change to the kitchens funnel.

**Tech Stack:** Next.js 15 (App Router, RSC), React 19, TypeScript (strict), Zod, `motion/react`, Tailwind v4. Path alias `@/` → `src/`. Package manager: **pnpm**.

**Source spec:** `docs/superpowers/specs/2026-06-19-headless-funnel-engine-design.md` (§3, §4, §5).

## Global Constraints

- **Verification = `pnpm tsc` + `pnpm lint`** (run from repo root). This repo has **no unit-test runner** (no vitest/jest, zero test files). For this type-safety-centric feature the **TypeScript compiler is the primary test surface**; behavior is confirmed by a manual browser smoke. NEVER run `pnpm build` (use `pnpm tsc`).
- **Work on `main`.** Do NOT create feature branches. Stage only the files each task names — never `git add -A` (the working tree has unrelated funnel WIP + staged asset renames that must not be swept into commits).
- **Coding conventions (enforced):** one React component per file; named exports only (no `export default`); no file-level constants in component files (→ `constants/`); no standalone helper functions in component files (→ `lib/`); no barrel files in `lib/`/`constants/`/`ui/`; imports sorted (perfectionist/sort-imports — external before internal, alphabetical); `if` bodies always braced + newline (antfu/if-newline).
- **Directionality:** `shared/` never imports from `features/`. All new code lives under `src/shared/domains/funnels/`.
- **No behavior change to kitchens** in this phase — kitchens must render identically before and after.

---

## File Structure

**New files (all under `src/shared/domains/funnels/`):**
- `lib/define-block.ts` — `CustomBlock<P>` type + `defineBlock<P>()` identity helper.
- `lib/define-step.ts` — `CustomStep<C, A>` type + `defineStep<C, A>()` identity helper.
- `lib/configure-step.ts` — `configureStep()` type-safe shallow-merge-with-deep-content helper for shared steps.

**Modified files:**
- `types.ts` — add `| CustomBlock` to `MarketingBlock`; add `| CustomStep` to `FunnelStep`; make `ContentOf` / `AnswerOf` conditional so custom steps resolve their generic content/answer types.
- `ui/funnel-landing.tsx:35-40` — `renderBlock` branches on `block.kind === 'custom'`.
- `ui/funnel-engine.tsx:50` — step dispatch branches on `engine.step.kind === 'custom'`.
- `ui/blocks/reviews-block.tsx` — honor per-funnel `items` override (add `items?` to `ReviewsBlockContent`).

**Why these boundaries:** the two `define-*` helpers and `configure-step` are independent, single-responsibility files (mirrors the existing `lib/funnel-flow.ts` granularity). Type changes concentrate in `types.ts` (the single source of truth for the unions). Each dispatch seam is one small, documented branch added to an existing cast site.

---

## Task 1: `CustomBlock` type + `defineBlock` helper

**Files:**
- Create: `src/shared/domains/funnels/lib/define-block.ts`
- Modify: `src/shared/domains/funnels/types.ts` (the `MarketingBlock` union, ~line 186-197)

**Interfaces:**
- Produces: `CustomBlock<P>` interface, `defineBlock<P>(def) => CustomBlock<P>`. `MarketingBlock` gains a `{ kind: 'custom' } & CustomBlock` arm consumed by Task 2.

- [ ] **Step 1: Create the helper + type**

Create `src/shared/domains/funnels/lib/define-block.ts`:

```ts
import type { FC } from 'react'
import type { z } from 'zod'
import type { FunnelContext } from '@/shared/domains/funnels/types'

/**
 * A funnel-unique marketing block injected inline — the Tier-3 escape hatch.
 * Carries its own component so it never touches the global MARKETING_REGISTRY
 * or the MarketingBlock kind union. see ../DOCS.md#block-tiers (added in Phase 3)
 */
export interface CustomBlock<P = unknown> {
  kind: 'custom'
  /** Stable key for React lists + analytics; unique within a funnel's blocks. */
  id: string
  content: P
  component: FC<{ content: P, ctx: FunnelContext }>
  /** Optional runtime guard for content sourced from anywhere untrusted. */
  schema?: z.ZodType<P>
}

/**
 * Identity helper that preserves the per-block content type `P` at the authoring
 * site (defeats `Record<string, …>` widening). Returns a ready-to-place block.
 */
export function defineBlock<P>(def: {
  id: string
  content: P
  component: FC<{ content: P, ctx: FunnelContext }>
  schema?: z.ZodType<P>
}): CustomBlock<P> {
  return { kind: 'custom', ...def }
}
```

- [ ] **Step 2: Add the union arm in `types.ts`**

In `src/shared/domains/funnels/types.ts`, add the import at the top of the marketing-blocks section and extend the union. Change the `MarketingBlock` union (currently ending at the `value` arm, ~line 186-197) to:

```ts
import type { CustomBlock } from '@/shared/domains/funnels/lib/define-block'

// … existing per-kind content interfaces unchanged …

export type MarketingBlock
  = | { kind: 'reviews', content: ReviewsBlockContent }
    | { kind: 'testimonials', content: TestimonialsBlockContent }
    | { kind: 'portfolio', content: PortfolioBlockContent }
    | { kind: 'licensing', content: LicensingBlockContent }
    | { kind: 'guarantee', content: GuaranteeBlockContent }
    | { kind: 'problem', content: ProblemBlockContent }
    | { kind: 'value', content: ValueBlockContent }
    | { kind: 'process', content: ProcessBlockContent }
    | { kind: 'faq', content: FaqBlockContent }
    | { kind: 'callout', content: CalloutBlockContent }
    | { kind: 'cta', content: CtaBlockContent }
    | CustomBlock
```

Note: `MarketingBlockKind = MarketingBlock['kind']` now includes `'custom'`. `MarketingRegistry` is `{ [K in MarketingBlockKind]: … }` — adding `'custom'` would force a registry entry. Prevent that by excluding `'custom'` from the registry's mapped type. Update `MarketingRegistry` (~line 202):

```ts
export type RegistryBlockKind = Exclude<MarketingBlockKind, 'custom'>
export type MarketingRegistry = { [K in RegistryBlockKind]: MarketingBlockComponentFor<K> }
```

And constrain `MarketingBlockComponentFor` to the registry kinds (~line 200):

```ts
export type MarketingBlockComponentFor<K extends RegistryBlockKind>
  = ComponentType<{ content: Extract<MarketingBlock, { kind: K }>['content'], ctx: FunnelContext }>
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm tsc`
Expected: PASS (no errors). The existing `MARKETING_REGISTRY` still satisfies `MarketingRegistry` because `'custom'` is excluded from its keys.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: PASS. (If imports are flagged, sort per perfectionist — external `react`/`zod` type imports before the internal `@/` import.)

- [ ] **Step 5: Commit**

```bash
git add src/shared/domains/funnels/lib/define-block.ts src/shared/domains/funnels/types.ts
git commit -m "feat(funnel): defineBlock + CustomBlock union arm (Tier-3 block injection)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Block render dispatch branch

**Files:**
- Modify: `src/shared/domains/funnels/ui/funnel-landing.tsx:35-40` (the `renderBlock` function)

**Interfaces:**
- Consumes: `CustomBlock` from Task 1 (via the widened `MarketingBlock` union).
- Produces: `renderBlock` now renders inline-component blocks. No new exported symbols.

- [ ] **Step 1: Branch on the custom kind**

In `src/shared/domains/funnels/ui/funnel-landing.tsx`, replace the `renderBlock` function (lines 35-40) with:

```tsx
function renderBlock(block: MarketingBlock, ctx: FunnelContext, _index: number) {
  // Tier-3 escape hatch: a custom block carries its own component inline, so it
  // bypasses the registry entirely. see ../lib/define-block.ts
  if (block.kind === 'custom') {
    const Custom = block.component as (props: { content: unknown, ctx: FunnelContext }) => ReactNode
    return <Custom content={block.content} ctx={ctx} />
  }
  // Re-narrow per kind: the registry is typed per kind; indexing by the union
  // widens the lookup, so cast through the per-kind content like the step seam.
  const Block = MARKETING_REGISTRY[block.kind] as (props: { content: typeof block.content, ctx: FunnelContext }) => ReactNode
  return <Block content={block.content} ctx={ctx} />
}
```

Note: the React `key` at the call site (line 105) is `` `${block.kind}-${i}` `` — for custom blocks this becomes `custom-0` etc., which stays unique by index. No change needed there.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm tsc`
Expected: PASS. `block.kind === 'custom'` narrows `block` to `CustomBlock`, so `block.component` and `block.content` are available.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 4: Manual smoke — kitchens unchanged**

Run the app and confirm the kitchens funnel landing renders exactly as before (no custom blocks in kitchens yet, so this proves the new branch is inert for shared blocks).

Run: `pnpm dev` then load `http://localhost:3000/funnels/kitchens` (or use the Playwright MCP browser to navigate and snapshot).
Expected: landing renders hero + all existing marketing blocks; no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/domains/funnels/ui/funnel-landing.tsx
git commit -m "feat(funnel): render custom blocks inline at the landing dispatch seam

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `CustomStep` type + `defineStep` helper + conditional `ContentOf`/`AnswerOf`

**Files:**
- Create: `src/shared/domains/funnels/lib/define-step.ts`
- Modify: `src/shared/domains/funnels/types.ts` (`FunnelStep` union ~line 109; `ContentOf` ~line 98; `AnswerOf` ~line 25; `StepRegistry` ~line 139)

**Interfaces:**
- Produces: `CustomStep<C, A>` interface, `defineStep<C, A>(def) => CustomStep<C, A>`. `FunnelStep` gains the custom arm. `ContentOf<CustomStep<C,A>> = C` and `AnswerOf<CustomStep<C,A>> = A` so `StepProps<CustomStep<C,A>>` types the component's `content`/`value` correctly. Consumed by Task 4.

- [ ] **Step 1: Create the helper + type**

Create `src/shared/domains/funnels/lib/define-step.ts`:

```ts
import type { ComponentType } from 'react'
import type { z } from 'zod'
import type { StepId, StepProps } from '@/shared/domains/funnels/types'

/**
 * A funnel-unique step injected inline — the Tier-3 escape hatch for steps.
 * Carries its own component so it never touches STEP_REGISTRY, ContentByKind,
 * or AnswerByKind. `C` = its content shape, `A` = its answer shape.
 * see ../DOCS.md#step-tiers (added in Phase 3)
 */
export interface CustomStep<C = unknown, A = unknown> {
  kind: 'custom'
  id: StepId
  content: C
  component: ComponentType<StepProps<CustomStep<C, A>>>
  /** Optional runtime guard for the step's answer. */
  answerSchema?: z.ZodType<A>
}

/**
 * Identity helper preserving the content type `C` and answer type `A` at the
 * authoring site. (Phase 2 adds an optional `next` transition to this shape.)
 */
export function defineStep<C, A>(def: {
  id: StepId
  content: C
  component: ComponentType<StepProps<CustomStep<C, A>>>
  answerSchema?: z.ZodType<A>
}): CustomStep<C, A> {
  return { kind: 'custom', ...def }
}
```

- [ ] **Step 2: Wire the union + conditional resolvers in `types.ts`**

In `src/shared/domains/funnels/types.ts`:

Add the import near the top:

```ts
import type { CustomStep } from '@/shared/domains/funnels/lib/define-step'
```

Extend the `FunnelStep` union (line 109):

```ts
export type FunnelStep = AddressStep | CardSelectStep | ConfirmationStep | LocationStep | PiiStep | CustomStep
```

`StepKind = FunnelStep['kind']` now includes `'custom'`. Make `ContentOf` and `AnswerOf` resolve custom steps via their generics, and keep registry kinds indexing the keyed maps. Replace `AnswerOf` (line 25) and `ContentOf` (line 98):

```ts
export type AnswerOf<S extends FunnelStep>
  = S extends CustomStep<unknown, infer A> ? A : AnswerByKind[Exclude<S['kind'], 'custom'>]

export type ContentOf<S extends FunnelStep>
  = S extends CustomStep<infer C, unknown> ? C : ContentByKind[Exclude<S['kind'], 'custom'>]
```

These are distributive conditional types: for the `CustomStep` arm they yield `A`/`C`; for every registry step the `Exclude<…, 'custom'>` keeps the keyed lookup valid (a non-custom step's `kind` is unaffected by the exclude).

Constrain `StepRegistry` to exclude `'custom'` (line 138-139):

```ts
export type RegistryStepKind = Exclude<StepKind, 'custom'>
export type StepComponentFor<K extends RegistryStepKind> = ComponentType<StepProps<Extract<FunnelStep, { kind: K }>>>
export type StepRegistry = { [K in RegistryStepKind]: StepComponentFor<K> }
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm tsc`
Expected: PASS. Existing `STEP_REGISTRY` still satisfies `StepRegistry` (custom excluded). Existing step components typed `StepProps<XxxStep>` are unaffected (their `kind` isn't `'custom'`, so `ContentOf`/`AnswerOf` fall to the keyed maps).

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/domains/funnels/lib/define-step.ts src/shared/domains/funnels/types.ts
git commit -m "feat(funnel): defineStep + CustomStep union arm with conditional ContentOf/AnswerOf

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Step render dispatch branch

**Files:**
- Modify: `src/shared/domains/funnels/ui/funnel-engine.tsx:45-65` (step dispatch + element)

**Interfaces:**
- Consumes: `CustomStep` from Task 3 (via the widened `FunnelStep` union on `engine.step`).
- Produces: the engine renders inline-component steps. No new exported symbols.

- [ ] **Step 1: Branch on the custom kind**

In `src/shared/domains/funnels/ui/funnel-engine.tsx`, replace the single dispatch line (line 50) and the `stepEl` (lines 52-65) so the component is chosen before building the element. Replace:

```tsx
  // Single documented dispatch seam: the registry is typed per kind, but indexing
  // by a union `kind` widens the lookup. Re-narrow here with the ONE cast; each
  // step component stays fully typed against its own StepProps<S>.
  const StepView = STEP_REGISTRY[engine.step.kind] as ComponentType<StepProps>
```

with:

```tsx
  // Dispatch seam. A custom step (Tier-3) carries its own component inline and
  // bypasses STEP_REGISTRY; registry steps re-narrow through the ONE cast. Each
  // step component stays fully typed against its own StepProps<S>.
  // see ../lib/define-step.ts
  const StepView = (engine.step.kind === 'custom'
    ? engine.step.component
    : STEP_REGISTRY[engine.step.kind]) as ComponentType<StepProps>
```

The `stepEl` JSX below (lines 52-65) is unchanged — it already passes the full uniform `StepProps`.

- [ ] **Step 2: Verify it compiles**

Run: `pnpm tsc`
Expected: PASS. `engine.step.kind === 'custom'` narrows `engine.step` to `CustomStep`, exposing `.component`.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 4: Manual smoke — kitchens steps unchanged**

Load the kitchens funnel and walk through 2-3 steps (layout → ownership → location). Confirm steps render and advance exactly as before.

Run: `pnpm dev`, navigate `/funnels/kitchens`, answer the first card-select; or drive via Playwright MCP.
Expected: steps render and advance; no console errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/domains/funnels/ui/funnel-engine.tsx
git commit -m "feat(funnel): render custom steps inline at the engine dispatch seam

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `configureStep` Tier-2 override helper

**Files:**
- Create: `src/shared/domains/funnels/lib/configure-step.ts`

**Interfaces:**
- Consumes: `FunnelStep`, `ContentOf` from `types.ts`.
- Produces: `configureStep<S extends FunnelStep>(base: S, overrides: { content?: Partial<ContentOf<S>> }) => S`. The canonical type-safe way to customize a shared step's content per funnel (replaces hand-spreading `{ ...ZIP_STEP, content: { ...ZIP_STEP.content, … } }`).

- [ ] **Step 1: Create the helper**

Create `src/shared/domains/funnels/lib/configure-step.ts`:

```ts
import type { ContentOf, FunnelStep } from '@/shared/domains/funnels/types'

/**
 * Customize a shared step per funnel: shallow-merge `overrides.content` onto the
 * base step's content (one level deep on `content`, which is the field funnels
 * tune). Preserves the base step's exact type `S`. The canonical replacement for
 * hand-spreading `{ ...BASE, content: { ...BASE.content, … } }`.
 * see ../DOCS.md#step-tiers (added in Phase 3)
 */
export function configureStep<S extends FunnelStep>(
  base: S,
  overrides: { content?: Partial<ContentOf<S>> },
): S {
  if (!overrides.content) {
    return base
  }
  return { ...base, content: { ...base.content, ...overrides.content } }
}
```

Note: `Partial<ContentOf<S>>` is intentionally a shallow merge — nested objects within `content` (e.g. a card-select's `options` record) are replaced wholesale, matching the existing spread-override behavior in `kitchens.ts`. (Phase 2 extends the `overrides` param with an optional `next` transition.)

- [ ] **Step 2: Verify it compiles**

Run: `pnpm tsc`
Expected: PASS.

- [ ] **Step 3: Prove it type-checks against a real base step (temporary scratch)**

Append a temporary usage to the BOTTOM of `src/shared/domains/funnels/constants/kitchens.ts` to confirm inference, then run tsc, then delete it before committing:

```ts
// TEMP — delete before commit
import { configureStep } from '@/shared/domains/funnels/lib/configure-step'
import { ZIP_STEP } from '@/shared/domains/funnels/ui/steps/location-step'
const _scratch = configureStep(ZIP_STEP, { content: { subtitle: 'Kitchens only' } })
void _scratch
```

Run: `pnpm tsc`
Expected: PASS — `subtitle` is accepted (it's on `LocationContent`); a bogus key (e.g. `{ content: { nope: 1 } }`) would error. After confirming, **delete the TEMP block**.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/domains/funnels/lib/configure-step.ts
git commit -m "feat(funnel): configureStep type-safe Tier-2 override helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Tier-2 fix — `reviews` block honors per-funnel content

**Files:**
- Modify: `src/shared/domains/funnels/types.ts` (`ReviewsBlockContent`, ~line 143)
- Modify: `src/shared/domains/funnels/ui/blocks/reviews-block.tsx`

**Interfaces:**
- Consumes: `ReviewsBlockContent`, the global `testimonials` constant.
- Produces: `reviews` block renders `content.items ?? globalDefault`, matching `testimonials-block.tsx`'s existing pattern.

> **Context (verified 2026-06-19):** `testimonials-block.tsx:16` ALREADY does `content.items ?? DEFAULT_ITEMS`, so it needs no change. `reviews-block.tsx` hard-renders the global `testimonials` and ignores its own `content` (it uses only `content.label`; the `rating`/`count` fields on `ReviewsBlockContent` are currently dead). This task makes `reviews` overridable. The dead `rating`/`count` fields are left as-is (out of scope — flag for a future cleanup).

- [ ] **Step 1: Add `items?` to `ReviewsBlockContent`**

In `src/shared/domains/funnels/types.ts`, change (line 143):

```ts
export interface ReviewsBlockContent { rating: number, count: number, label?: string, items?: TestimonialItem[] }
```

(`TestimonialItem` is already declared on the next line, so it's in scope.)

- [ ] **Step 2: Honor the override in the block**

Replace `src/shared/domains/funnels/ui/blocks/reviews-block.tsx` with:

```tsx
import type { FunnelContext, ReviewsBlockContent, TestimonialItem } from '@/shared/domains/funnels/types'
import { ReviewCard } from '@/shared/components/reviews/review-card'
import { testimonials } from '@/shared/constants/company'

const DEFAULT_ITEMS: TestimonialItem[] = testimonials.map(t => ({
  image: t.image,
  location: t.location,
  name: t.name,
  rating: t.rating,
  text: t.text,
}))

export function ReviewsBlock({ content }: { content: ReviewsBlockContent, ctx: FunnelContext }) {
  const items = content.items ?? DEFAULT_ITEMS
  return (
    <section className="flex flex-col items-center gap-6 py-10">
      {content.label ? <h2 className="text-foreground text-center text-2xl font-semibold">{content.label}</h2> : null}
      <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(t => (
          <ReviewCard key={t.name} name={t.name} text={t.text} rating={t.rating} location={t.location} platform="Google" image={t.image} />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verify it compiles**

Run: `pnpm tsc`
Expected: PASS.

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 5: Manual smoke**

Load `/funnels/kitchens`; the reviews block renders the global testimonials as before (kitchens passes no `items`, so the default path is exercised).
Expected: identical to before.

- [ ] **Step 6: Commit**

```bash
git add src/shared/domains/funnels/types.ts src/shared/domains/funnels/ui/blocks/reviews-block.tsx
git commit -m "feat(funnel): reviews block honors per-funnel items override (Tier-2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: End-to-end injection proof (temporary), then final verification

**Files:**
- Temporarily modify: `src/shared/domains/funnels/constants/kitchens.ts` (add one custom block, verify, then revert)

**Interfaces:**
- Consumes: `defineBlock` (Task 1), the landing dispatch branch (Task 2).
- Produces: nothing permanent — this task proves the escape hatch renders end-to-end, then reverts so kitchens is unchanged (per the no-behavior-change constraint).

- [ ] **Step 1: Add a throwaway custom block to kitchens**

Temporarily add to the TOP of the `landing.blocks` array in `src/shared/domains/funnels/constants/kitchens.ts` (and import `defineBlock`):

```ts
import { defineBlock } from '@/shared/domains/funnels/lib/define-block'

// … inside landing: { blocks: [ … ] }, as the first element:
defineBlock({
  id: 'proof',
  content: { msg: 'Tier-3 custom block renders ✅' },
  component: ({ content }) => <section className="py-10 text-center text-lg font-semibold">{content.msg}</section>,
}),
```

- [ ] **Step 2: Verify compile + render**

Run: `pnpm tsc` → Expected: PASS (note `content.msg` is typed from the inline `content`).
Run: `pnpm dev`, load `/funnels/kitchens` (or Playwright MCP snapshot).
Expected: the "Tier-3 custom block renders ✅" banner appears at the top of the landing blocks, above the existing shared blocks — proving inline injection + registry fallthrough coexist.

- [ ] **Step 3: Revert the throwaway block**

Remove the `defineBlock({...})` element and its import from `kitchens.ts`.

Run: `git diff src/shared/domains/funnels/constants/kitchens.ts`
Expected: empty diff (kitchens fully restored).

- [ ] **Step 4: Full-phase verification**

Run: `pnpm tsc`
Expected: PASS.
Run: `pnpm lint`
Expected: PASS.
Run: `pnpm dev`, load `/funnels/kitchens`, walk the full funnel landing → first step → advance.
Expected: identical behavior to pre-Phase-1; no console errors.

- [ ] **Step 5: No commit**

This task produces no committed changes (the proof was reverted). Phase 1 is complete; the four `define-*`/`configure-*`/dispatch/reviews commits from Tasks 1-6 are the deliverable.

---

## Self-Review (against the spec)

**Spec coverage (§3-§5):**
- §4.1 Tier-3 block injection (`defineBlock`, `CustomBlock`, union arm, dispatch) → Tasks 1, 2. ✓
- §4.2 Tier-2 shared-block override → Task 6 (scoped to `reviews`; `testimonials` already compliant — discrepancy flagged). ✓
- §5.1 Tier-3 step injection (`defineStep`, `CustomStep`, conditional resolvers, dispatch) → Tasks 3, 4. ✓
- §5.2 `configureStep` Tier-2 helper → Task 5. ✓
- §6 branching / §7 docs → **deferred to Phase 2 and Phase 3 plans** (out of this plan's scope; `defineStep`/`configureStep` intentionally ship without `next` so Phase 1 has no dependency on the outcome model).

**Placeholder scan:** No TBD/TODO; every code step shows complete code; the only `// TEMP`/throwaway snippets (Task 5 Step 3, Task 7) are explicitly created-then-deleted with verification.

**Type consistency:** `CustomBlock`/`CustomStep` names, `defineBlock`/`defineStep`/`configureStep` signatures, and `RegistryBlockKind`/`RegistryStepKind`/`ContentOf`/`AnswerOf` are used identically across Tasks 1-6. The `'custom'` literal is consistent at every narrowing site (landing dispatch, engine dispatch, conditional types).

**Note:** This plan is **Phase 1 of 3**. Phases 2 (branching & disqualification engine) and 3 (DOCS.md + memory refresh) will be authored as their own plans once Phase 1 lands and the helper signatures are concrete.
