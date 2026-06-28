# Funnel Shell Composition — Design

**Date:** 2026-06-28
**Status:** Approved design → ready for implementation plan
**Supersedes:** Task 3 of `docs/superpowers/plans/2026-06-27-funnel-shell-composition-refactor.md` (Tasks 1, 2, 4 survive; see "Relationship to the prior plan").

## Goal

Restructure the funnel engine around a single funnel **config object** that is built once, provided once through React Context, and consumed by sub-components wherever they need it — including their own layout/frame. This replaces the engine's imperative `let body` 3-way branch (which re-assembles the header + content rail + footer for each view) and the prop-threaded `ctx` ambient bus.

The root component (`FunnelShell`) loads the config into context and renders the boundary crossfade, the single footer, and the view switch. Per-view frame components (`FunnelFrame`) read their layout slice from context. The architecture is shaped so a future database-driven funnel builder can feed the config object from a JSONB row through the *same* provider, with no component changes.

This is a **behavior-preserving refactor**: rendered output and animations are identical to today on both the kitchens and bathrooms funnels.

## Background

An architecture audit (`.superpowers/research/funnel-audit/agent-1-shell-composition.md`) found three issues in the engine's view-hosting:

- **C1 — footer rendered at three independent call sites** (`funnel-landing.tsx`, engine steps branch, engine confirmation branch).
- **C2 — the imperative `let body` branch duplicates frame authorship** (header + rail + footer re-assembled per view; flat `motion.div` defeats DevTools composition visibility).
- **I1 — the content rail diverges** between steps (`flex flex-col`, `pb-10 pt-16`) and confirmation (`pb-16 pt-20`, no flex).

Since the audit, the steps branch also gained a **blueprint-grid background**: a `funnel-grid-bg` layer at `position: fixed; inset: 0; z-0`, with all step content lifted into a sibling `z-10` layer (see `globals.css` `.funnel-grid-bg`). Nothing in the engine owns this z-layering — it is inline in the steps branch.

The audit recommended *against* React Context for the layout, but that advice was scoped to the current world where the config is a **compile-time constant** (`getFunnel(slug)`): with a static object, threading a prop is simpler than a provider. The project's direction is a **database-driven funnel system** where the config is a **runtime value fetched from a JSONB row**. With a fetched object, Context is the correct tool — you do not prop-drill a fetched config through every level. This design adopts Context accordingly; it supersedes the audit's note rather than contradicting good practice.

## Architecture

### The data/behavior split (why this shape is correct)

The funnel system already separates **config (serializable data)** from **behavior (code keyed by a `kind` string)**:

- `FunnelSpec` is almost entirely plain data — `steps`, `landing.blocks`, `hero`, `theme`, `pixel` are `{ id, kind, content }` objects with string-referenced assets. The only function on the spec is `flow?`.
- Behavior lives in `STEP_REGISTRY` / `MARKETING_REGISTRY`, resolved by the `kind` tag. Validators live *inside* the step components, not in the spec.

This design extends that split: the funnel config becomes the single source of truth in Context (the future JSONB row), and components — including the frame — read what they need from it. Layout stops being a separate threaded object and becomes a **field on the config**.

### Config vs. runtime state (a hard boundary)

- **`FunnelConfigContext`** carries the *static definition* — identity, content, theme, pixel, and **layout**. This is what becomes the JSONB row. Provided once at the root; stable for the life of the funnel.
- **`useFunnelEngine()`** (unchanged) owns *runtime state* — the current step, accumulated answers, and the scroll-driven `stickyOpacity` MotionValue. These are **not** in config-context (they change constantly and would re-render every consumer). Runtime values pass to views as plain props.

"Engine" survives as the state hook; "Shell" is the rendered root/provider component. Clean split: the shell renders + provides; the engine computes.

### Types

```tsx
// Which views get a shared, config-driven frame. Landing is bespoke (see below)
// and is NOT framed, so it is absent from the layout map.
export type FramedView = 'steps' | 'confirmation'

// How the shell frames one view: content-rail layout + backdrop. Pure data.
export type FrameSpec = {
  rail: 'stage' | 'page'        // rail padding/flex
  background: 'grid' | 'none'   // blueprint-grid backdrop on/off
}

export type FunnelLayout = Record<FramedView, FrameSpec>

// The single funnel definition held in Context. Today derived from FunnelSpec;
// tomorrow hydrated from a JSONB row. `layout` is fully resolved (defaults applied).
export type FunnelConfig = Omit<FunnelSpec, 'layout'> & { layout: FunnelLayout }
```

`FunnelSpec` gains an optional authoring override: `layout?: Partial<Record<FramedView, Partial<FrameSpec>>>`. `buildFunnelConfig(spec)` deep-merges it over `DEFAULT_FUNNEL_LAYOUT` so the running config always has a fully-resolved `layout`:

```tsx
export const DEFAULT_FUNNEL_LAYOUT: FunnelLayout = {
  steps:        { rail: 'stage', background: 'grid' },
  confirmation: { rail: 'page',  background: 'none' },
}
```

Defaults are applied at **config construction** — the same seam where a future JSONB row would be normalized on load. A component never sees a default; it reads `config.layout[view]`. (This is the repo's existing "defaults with override" principle, applied to layout.)

### Component tree

```
FunnelShell (root — was FunnelEngine)
├─ buildFunnelConfig(spec)              // today from the constant spec; future from the JSONB row
├─ <FunnelConfigProvider value={config}>  // loaded ONCE here (React Context)
│   ├─ useFunnelEngine(spec)            // runtime: step, answers, scroll
│   └─ <AnimatePresence> (boundary crossfade, opacity-only, key=view)
│        <motion.div key={view} className="min-h-dvh w-full">
│          { view==='landing'      ? <FunnelLanding>{heroEntry}</FunnelLanding>
│          : view==='confirmation' ? <FunnelConfirmationView stepEl stickyOpacity/>
│          :                         <FunnelStepsView engine stepEl currentIndex stickyOpacity reduceMotion/> }
│          <FunnelFooter className="relative z-10"/>   // ONE mount, all views
│        </motion.div>
└─ </FunnelConfigProvider>
```

| Component / unit | File | Responsibility |
|---|---|---|
| `FunnelShell` | `ui/funnel-shell.tsx` | Root. Builds config, provides `FunnelConfigContext`, runs `useFunnelEngine`, renders the boundary crossfade + single footer + view switch. (Rename of today's `FunnelEngine` component.) |
| `FunnelConfigContext` + `useFunnelConfig()` | `hooks/use-funnel-config.ts` (+ a tiny provider) | The Context and its consumer hook. `useFunnelConfig()` returns `FunnelConfig`; throws if used outside the provider. |
| `buildFunnelConfig` | `lib/build-funnel-config.ts` | `FunnelSpec → FunnelConfig`: resolves `layout` against `DEFAULT_FUNNEL_LAYOUT`. The future JSONB normalizer plugs in here. |
| `FunnelFrame` | `ui/funnel-frame.tsx` | Per-view chrome: reads `useFunnelConfig().layout[view]` → optional grid (`fixed inset-0 z-0`) + `z-10` lift + `<FunnelStickyHeader>` + content rail (classes by `rail`). The single owner of the grid/z-layering. Props: `{ view: FramedView, stickyOpacity, children }`. |
| `FunnelQuestionStage` | `ui/funnel-question-stage.tsx` | Fixed-height internal scroller + inner `AnimatePresence` (`key=step.id`, `overscroll-y-contain`). |
| `FunnelStepNav` | `ui/funnel-step-nav.tsx` | Back/Next cluster; `null` when no next step. (= prior plan Task 2.) |
| `FunnelStepsView` | `ui/funnel-steps-view.tsx` | `<FunnelFrame view="steps">` → progress + `FunnelQuestionStage` + `FunnelStepNav`. |
| `FunnelConfirmationView` | `ui/funnel-confirmation-view.tsx` | `<FunnelFrame view="confirmation">{stepEl}</FunnelFrame>`. |
| `FunnelLanding` | `ui/funnel-landing.tsx` (exists) | Bespoke: keeps its own `useScroll`-driven header + hero + marketing blocks. **Loses its footer.** Not framed by `FunnelFrame`. |
| `renderBlock` | `lib/render-block.tsx` | Moves out of the landing component file. (= prior plan Task 4.) |

### `FunnelFrame` contract

```tsx
export function FunnelFrame({ view, stickyOpacity, children }: {
  view: FramedView
  stickyOpacity: MotionValue<number>
  children: ReactNode
}) {
  const { layout } = useFunnelConfig()
  const frame = layout[view]
  // background==='grid' → render the fixed z-0 grid layer + lift the rest into relative z-10
  // rail==='stage'      → `mx-auto flex w-full flex-col px-5 pb-10 pt-16 ${FUNNEL_RAIL_MAX_W}`
  // rail==='page'       → `mx-auto w-full ${FUNNEL_RAIL_MAX_W} px-5 pb-16 pt-20`
  // then: <FunnelStickyHeader opacity={stickyOpacity} widthClass={FUNNEL_RAIL_MAX_W}/> + rail({children})
}
```

`view` is **identity, not config** — the view component inherently knows which view it is, so passing the literal keeps the frame self-contained while the config stays in Context. The grid/z-layering lives entirely here.

### The footer — single mount, peek preserved, grid-safe

The footer is authored **once**, in `FunnelShell`, inside the boundary `motion.div`, after the view element, with `relative z-10`:

```tsx
<FunnelFooter className="relative z-10" />
```

- **Inside the `min-h-dvh` `motion.div`** → preserves the ~50%-visible footer peek on step pages (a footer hoisted *outside* that box would be pushed below the fold).
- **`relative z-10`** → paints above the steps grid (`z-0`); harmless on the grid-less views.
- **One mount for all three views** → fully satisfies C1.

`FunnelFooter` now reads `useFunnelConfig()` for its data (drops the `ctx` prop) and gains an optional `className` (merged via `cn()`). `FunnelLanding` loses its own footer.

### Scope boundary for `StepProps.ctx`

Step components currently receive an ambient `ctx` via `StepProps`. To keep this refactor bounded and behavior-preserving, the **canonical** funnel data moves to `FunnelConfigContext`, and the existing `StepProps.ctx` is **retained, derived from the config** by `FunnelShell` — the step API is unchanged. New consumers introduced here (`FunnelFrame`, `FunnelFooter`) use `useFunnelConfig()`. Migrating the step components off the `ctx` prop onto the hook is explicitly **out of scope** (a clean follow-up once the context exists).

### Adding a future view

A new view type (e.g. a "calculating results" interstitial) becomes: add it to `FramedView` + `DEFAULT_FUNNEL_LAYOUT`, render `<FunnelFrame view="interstitial">body</FunnelFrame>`, and add one ternary arm. It inherits header, grid, rail, footer, and crossfade for free — no slot system, no view registry.

## Forward compatibility (database-driven funnels)

This design is explicitly shaped so a future "build funnels from a UI, stored as JSONB" capability is not made harder:

- **The config is the JSONB row.** `FunnelConfig` (incl. `layout`) is the object a builder UI authors and stores. `buildFunnelConfig` is where a JSONB row is normalized (defaults applied) on load — the exact seam used today for the constant spec.
- **One provider, one consumer hook.** Swapping the source from a constant to a DB fetch changes only `FunnelShell`'s `buildFunnelConfig` input; every consumer (`useFunnelConfig()`) is untouched.
- **Config flows through Context; components never read `slug`-keyed code lookups or static imports for per-funnel data.** This is the hydration rule the design follows. `getTradeFacts(slug)` (footer/SEO) is the one remaining code lookup; it becomes a config field read via `useFunnelConfig()` at migration time.
- **Obstacles that remain for the DB migration — none in this refactor:** (1) `flow` must become data (a rule DSL or named-strategy registry); (2) `FunnelSlug` must loosen from a compile-time union to a runtime string with an async source; (3) per-kind `content` shapes need runtime Zod schemas at the builder's write boundary. Separable future projects, unblocked by this work.

No database capability is built now. Everything is fed by the existing constant spec; this refactor is pure restructuring.

## What is preserved (non-negotiable)

- The `useScroll`-driven sticky header owned by `FunnelLanding` (a real motion-lifecycle constraint — `useScroll` rebinds to the hero ref on each Back-return remount). Landing keeps its OWN header instance; the `FunnelFrame` header is the constant-opacity copy for steps/confirmation.
- The inner step `AnimatePresence` (`key=engine.step.id`) — moves verbatim into `FunnelQuestionStage`.
- The outer opacity-only boundary crossfade — opacity (no transform) avoids a containing block that would trap the `position: fixed` header.
- `FUNNEL_RAIL_MAX_W` as the single rail-width constant.
- The blueprint-grid `z-0 / z-10` layering — relocated into `FunnelFrame`, intact.
- `overscroll-y-contain` on the question stage.

No compound-component/slot system; no Context for the rail *width* (the width stays the `FUNNEL_RAIL_MAX_W` constant — only the funnel *config* is in Context).

## File structure

**New:**
- `ui/funnel-shell.tsx` — `FunnelShell` (root provider; rename of `FunnelEngine`)
- `ui/funnel-frame.tsx` — `FunnelFrame`
- `ui/funnel-question-stage.tsx` — `FunnelQuestionStage`
- `ui/funnel-step-nav.tsx` — `FunnelStepNav`
- `ui/funnel-steps-view.tsx` — `FunnelStepsView`
- `ui/funnel-confirmation-view.tsx` — `FunnelConfirmationView`
- `hooks/use-funnel-config.ts` — `FunnelConfigContext`, `FunnelConfigProvider`, `useFunnelConfig()`
- `lib/build-funnel-config.ts` — `buildFunnelConfig`, `DEFAULT_FUNNEL_LAYOUT`
- `lib/render-block.tsx` — `renderBlock`
- Types (`FramedView`, `FrameSpec`, `FunnelLayout`, `FunnelConfig`) added to `types.ts`; `FunnelSpec` gains optional `layout?`.

**Modified:**
- `ui/funnel-engine.tsx` → becomes `funnel-shell.tsx` (declarative switch, context provider, single footer, drop `contentWidth`, trim imports)
- `ui/funnel-landing.tsx` — remove footer mount + import; import `renderBlock` from `lib/`
- `ui/funnel-sticky-header.tsx` — `widthClass` required (prior plan Task 1; already committed `041d9574`)
- `ui/footer/funnel-footer.tsx` — read `useFunnelConfig()`; drop `ctx` prop; accept optional `className` via `cn()`
- The funnel route that renders `FunnelEngine` — update the import to `FunnelShell`.

**Conventions:** one React component per file; named exports only; no barrel files in `ui/`/`hooks/`/`lib/`; `shared/` never imports from `features/`; standalone helpers live in `lib/`, not component files; remove now-unused imports after moving code out.

## Testing / verification

No unit-test runner exists in this repo. Each task is verified with `pnpm tsc` + `pnpm lint`. The view-extraction work additionally requires a manual browser pass on BOTH `kitchens.localhost:3000` and `bathrooms.localhost:3000`:

- **Landing:** hero + scroll-driven sticky header reveal; marketing blocks; footer at the bottom (one mount).
- **Steps:** grid paints behind; progress + fixed question stage + Back/Next nav; footer below the cluster, painting *above* the grid; step→step animates via the inner stage (not a full-page crossfade); the stage scrolls internally without dragging the page.
- **PII step:** footer legal block peeks into the fold; page scrolls to reveal it.
- **Confirmation:** full-height page-scroll view + footer; no grid.
- **Transitions:** landing→Q2 and last-question→confirmation crossfade; the fixed sticky header stays anchored through fades.

NEVER run `pnpm build` or `pnpm db:push`. Work on `main`; stage only the files each task names; commit each task separately with the trailer:
`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Relationship to the prior plan

`docs/superpowers/plans/2026-06-27-funnel-shell-composition-refactor.md`:

- **Task 1** (make `FunnelStickyHeader.widthClass` required) — DONE, committed `041d9574`.
- **Task 2** (extract `FunnelStepNav`) — survives unchanged; reused.
- **Task 4** (move `renderBlock` to `lib/`) — survives unchanged; reused.
- **Task 3** (extract views + declarative switch + single footer) — **superseded.** The prior Task 3 predates both the blueprint grid and the database-driven direction; it proposed per-view re-assembly of the frame and a footer hoisted outside the views (unsafe against the grid). This design introduces the config-in-Context provider (`FunnelShell` + `FunnelConfig` + `useFunnelConfig`), the per-view `FunnelFrame` that reads its layout slice, `FunnelQuestionStage`, and the single grid-safe footer mount.

The implementation plan derived from this spec will sequence the work as: config types + `buildFunnelConfig` + provider/hook → `FunnelFrame` (absorbing grid/z-layering) → `FunnelQuestionStage` + `FunnelStepNav` → step/confirmation views → `FunnelShell` rewrite (provider + switch + single footer) + landing/footer/route updates → `renderBlock` move.
