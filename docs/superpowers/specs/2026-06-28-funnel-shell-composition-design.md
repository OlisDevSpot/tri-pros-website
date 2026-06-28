# Funnel Shell Composition — Design

**Date:** 2026-06-28
**Status:** Approved design → ready for implementation plan
**Supersedes:** Task 3 of `docs/superpowers/plans/2026-06-27-funnel-shell-composition-refactor.md` (Tasks 1, 2, 4 of that plan survive unchanged; see "Relationship to the prior plan").

## Goal

Replace the funnel engine's imperative `let body` 3-way view branch — which independently re-assembles the frame (sticky header + content rail + footer) for each view — with a single shared shell component (`FunnelShell`) that owns the non-landing frame and its z-layering, named view components, and a declarative view switch. The footer collapses from three mount points to one. The shell's frame settings are a serializable descriptor, so a future database-driven funnel builder can feed them from JSONB without changing the component.

This is a **behavior-preserving refactor**: rendered output and animations are identical to today on both the kitchens and bathrooms funnels.

## Background

An architecture audit (`.superpowers/research/funnel-audit/agent-1-shell-composition.md`) found two CRITICAL and one IMPORTANT issue in the engine's view-hosting:

- **C1 — footer rendered at three independent call sites** (`funnel-landing.tsx`, engine steps branch, engine confirmation branch). Any future per-view footer variation must coordinate three sites.
- **C2 — the imperative `let body` branch duplicates frame authorship.** Each new view must re-assemble header + rail + footer by hand, and the flat `motion.div` defeats React DevTools composition visibility.
- **I1 — the content rail diverges** between steps (`flex flex-col`, `pb-10 pt-16`) and confirmation (`pb-16 pt-20`, no flex) as ad-hoc Tailwind on sibling `div`s.

Since the audit, the steps branch also gained a **blueprint-grid background**: a `funnel-grid-bg` layer at `position: fixed; inset: 0; z-0`, with all step content lifted into a sibling `z-10` layer so it paints above the grid (see `globals.css` `.funnel-grid-bg`). Nothing in the engine "owns" this z-layering — it is inline in the steps branch. This is what makes a naive "hoist the footer outside the views" move unsafe: a footer outside the `z-10` layer can paint *behind* the fixed grid.

The shared-shell design resolves all of the above by giving the grid/z-layering a single owner.

## Architecture

### The data/behavior split (why this is the right shape)

The funnel system already separates **config (serializable data)** from **behavior (code keyed by a `kind` string)**:

- `FunnelSpec` is almost entirely plain data — `steps`, `landing.blocks`, `hero`, `theme`, `pixel` are `{ id, kind, content }` objects with string-referenced assets. The only function on the spec is `flow?`.
- Behavior lives in `STEP_REGISTRY` / `MARKETING_REGISTRY`, resolved by the `kind` tag. Validators live *inside* the step components, not in the spec.

The shell sits in the **behavior/infrastructure half**: it is a presentational component driven by props, never reading `spec` or `slug`. Its frame settings (`ShellConfig`) are *data* — the kind of thing a future builder UI exposes per funnel. This keeps the shell on the correct side of the eventual database migration line (see "Forward compatibility").

### Components

| Component | File | Responsibility | Used by |
|---|---|---|---|
| `FunnelShell` | `ui/funnel-shell.tsx` | The non-landing frame: optional grid background + z-layering + sticky header + content rail. The single owner of `z-0 grid / z-10 content`. | steps, confirmation views |
| `FunnelQuestionStage` | `ui/funnel-question-stage.tsx` | The fixed-height internal scroller + inner `AnimatePresence` (`key=step.id`, `overscroll-y-contain`). | steps view |
| `FunnelStepNav` | `ui/funnel-step-nav.tsx` | Back / Next cluster; `null` when no next step. | steps view |
| `FunnelStepsView` | `ui/funnel-steps-view.tsx` | Composes `FunnelShell` (steps config) → progress + question stage + nav. | engine |
| `FunnelConfirmationView` | `ui/funnel-confirmation-view.tsx` | Composes `FunnelShell` (confirmation config) → `stepEl`. | engine |
| `FunnelLanding` | `ui/funnel-landing.tsx` (exists) | Bespoke: keeps its own `useScroll`-driven header + hero + marketing blocks. **Loses its footer.** | engine |
| `renderBlock` | `lib/render-block.tsx` | Moves out of the landing component file per repo convention. | landing |

### The `ShellConfig` descriptor

A small serializable type describing how the shell frames one view:

```tsx
export type ShellConfig = {
  rail: 'stage' | 'page'        // content-rail layout/padding
  background: 'grid' | 'none'   // blueprint-grid backdrop on/off
}
```

Per-view configs are code constants today (in `constants/funnel-shell-config.ts`):

```tsx
export const STEPS_SHELL_CONFIG: ShellConfig = { rail: 'stage', background: 'grid' }
export const CONFIRMATION_SHELL_CONFIG: ShellConfig = { rail: 'page', background: 'none' }
```

Because `ShellConfig` is pure data, a future funnel row can carry it as JSONB (`funnelRow.shell`) and feed the same prop. The shell component never changes — only the *source* of `config` does (code constant → DB row).

### `FunnelShell` contract

```tsx
export function FunnelShell({ config, stickyOpacity, children }: {
  config: ShellConfig
  stickyOpacity: MotionValue<number>
  children: ReactNode
}) { /* … */ }
```

Renders, in order:
1. When `config.background === 'grid'`: the `funnel-grid-bg pointer-events-none fixed inset-0 z-0` layer (`aria-hidden`), and lifts the rest into a `relative z-10` wrapper. When `'none'`: no grid layer, no lift needed.
2. `<FunnelStickyHeader opacity={stickyOpacity} widthClass={FUNNEL_RAIL_MAX_W} />`.
3. The content-rail `div`, whose classes are chosen by `config.rail`:
   - `stage`: `mx-auto flex w-full flex-col px-5 pb-10 pt-16 ${FUNNEL_RAIL_MAX_W}` (verbatim from today's steps branch)
   - `page`: `mx-auto w-full ${FUNNEL_RAIL_MAX_W} px-5 pb-16 pt-20` (verbatim from today's confirmation branch)
4. `{children}` inside the rail.

All blueprint-grid and z-layering knowledge lives in this component and nowhere else.

### The footer — single mount, peek preserved, grid-safe

The footer is authored **once**, in the engine's return, **inside** the boundary `motion.div`, **after** the view element, carrying `relative z-10`:

```tsx
<FunnelFooter ctx={ctx} className="relative z-10" />
```

- **Inside the `min-h-dvh` `motion.div`** → preserves the ~50%-visible footer peek on step pages (a footer hoisted *outside* that box would be pushed fully below the fold).
- **`relative z-10`** → paints above the steps grid (`z-0`); harmless on the grid-less landing/confirmation views.
- **One mount for all three views** → fully satisfies audit finding C1 (down from three; the prior handoff's per-view fallback only reached two).

`FunnelLanding` loses its own `<FunnelFooter>`; the engine now supplies the footer for every view.

### `FunnelFooter` change

`FunnelFooter` gains an optional `className`, merged onto its root `<footer>` via `cn()`, so the engine can pass `relative z-10`. This is the one touch to a shared component; it stays on the `ctx` read-path (no new data sources).

### Engine return (declarative switch)

```tsx
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
        ? <FunnelLanding spec={spec} ctx={ctx} variant={variant} scrollToQuestionOnMount={engine.value != null}>{heroEntry}</FunnelLanding>
        : view === 'confirmation'
          ? <FunnelConfirmationView stepEl={stepEl} stickyOpacity={stickyOpacity} />
          : <FunnelStepsView spec={spec} engine={engine} stepEl={stepEl} currentIndex={currentIndex} stickyOpacity={stickyOpacity} reduceMotion={reduceMotion} />}
      <FunnelFooter ctx={ctx} className="relative z-10" />
    </motion.div>
  </AnimatePresence>
)
```

The `view` derivation (`engine.isFirst ? 'landing' : engine.step.kind === 'confirmation' ? 'confirmation' : 'steps'`), `heroEntry`, `stepEl`, `currentIndex`, `ctx`, and `stickyOpacity` are unchanged. The `contentWidth` alias is removed (use `FUNNEL_RAIL_MAX_W` directly; the views import it themselves).

### Adding a future view

A new view type (e.g. a "calculating results" interstitial) becomes:

```tsx
<FunnelShell config={{ rail: 'page', background: 'grid' }} stickyOpacity={stickyOpacity}>
  {interstitialBody}
</FunnelShell>
```

plus one ternary arm in the engine. It inherits the header, grid, rail, footer, and boundary crossfade for free. This is the "generic for future funnels/views" payoff without a view registry or slot system.

## Forward compatibility (database-driven funnels)

This design is explicitly shaped so a future "build funnels from a UI, stored as JSONB" capability is not made harder. Findings from the type-level review:

- **The spec is already ~95% serializable.** The only function on `FunnelSpec` is `flow?`. `ShellConfig` is pure data and slots into a future `funnelRow.shell` JSONB field with no component change.
- **The guiding rule this design follows:** per-funnel data flows through `ctx` (the ambient bus); the shell and views read props + `ctx`, never slug-keyed code lookups or static imports. `ctx` is the hydration seam — `{ slug, offer, theme, utm, pixel }` from a constant today, the same shape from a DB row tomorrow.
- **Obstacles that remain for the DB migration — none of them in the shell:** (1) `flow` must become data (a rule DSL or a named-strategy registry); (2) `FunnelSlug` must loosen from a compile-time union to a runtime string with an async `getFunnel`; (3) per-kind `content` shapes need runtime Zod schemas at the builder's write boundary; (4) `getTradeFacts(ctx.slug)` (used by the footer + SEO metadata) becomes a DB field read via `ctx`. These are separable future projects, unblocked and unworsened by this refactor.

No part of the database capability is built now. This section records the constraints the shell honors so the eventual migration is "change the source of the data, not the components."

## What is preserved (non-negotiable)

- The `useScroll`-driven sticky header owned by `FunnelLanding` (a real motion-lifecycle constraint — `useScroll` must rebind to the hero ref on each Back-return remount). Landing keeps its OWN header instance; the shell's header is the constant-opacity copy for steps/confirmation.
- The inner step `AnimatePresence` (`key=engine.step.id`) — moves verbatim into `FunnelQuestionStage`.
- The outer opacity-only boundary crossfade — opacity (no transform) avoids establishing a containing block that would trap the `position: fixed` header.
- `FUNNEL_RAIL_MAX_W` as the single rail-width constant; `ctx` as the ambient data bus.
- The blueprint-grid `z-0 / z-10` layering — relocated into `FunnelShell`, intact.
- `overscroll-y-contain` on the question stage.

No compound-component/slot system; no Context for the rail width. The shell takes plain props.

## File structure

**New:**
- `ui/funnel-shell.tsx` — `FunnelShell`
- `ui/funnel-question-stage.tsx` — `FunnelQuestionStage`
- `ui/funnel-step-nav.tsx` — `FunnelStepNav`
- `ui/funnel-steps-view.tsx` — `FunnelStepsView`
- `ui/funnel-confirmation-view.tsx` — `FunnelConfirmationView`
- `lib/render-block.tsx` — `renderBlock`
- `constants/funnel-shell-config.ts` — `ShellConfig` type + `STEPS_SHELL_CONFIG` / `CONFIRMATION_SHELL_CONFIG`

**Modified:**
- `ui/funnel-engine.tsx` — declarative switch, single footer mount, drop `contentWidth`, trim imports
- `ui/funnel-landing.tsx` — remove footer mount + import; import `renderBlock` from `lib/`
- `ui/funnel-sticky-header.tsx` — `widthClass` made required (prior plan Task 1; already committed `041d9574`)
- `ui/footer/funnel-footer.tsx` — accept optional `className` via `cn()`

**Conventions:** one React component per file; named exports only; no barrel files in `ui/`; `shared/` never imports from `features/`; standalone helpers live in `lib/`, not component files; remove now-unused imports after moving code out.

## Testing / verification

No unit-test runner exists in this repo. Each task is verified with `pnpm tsc` + `pnpm lint`. The view-extraction task additionally requires a manual browser pass on BOTH `kitchens.localhost:3000` and `bathrooms.localhost:3000`:

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
- **Task 2** (extract `FunnelStepNav`) — survives unchanged; reused here.
- **Task 4** (move `renderBlock` to `lib/`) — survives unchanged; reused here.
- **Task 3** (extract step/confirmation views + declarative switch + single footer) — **superseded by this design.** The prior Task 3 predates the blueprint grid and proposed a footer hoisted *outside* the views (unsafe against the grid) and per-view re-assembly of the frame. This design introduces `FunnelShell` + `ShellConfig` to own the frame and z-layering, keeps the footer inside the boundary `motion.div` with `relative z-10`, and adds `FunnelQuestionStage`.

The implementation plan derived from this spec will re-sequence the work accordingly.
