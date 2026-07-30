# Multi-Step-Flow Core Extraction — Design Spec

> **Status:** Design approved 2026-07-29 (brainstorming). Phase 1 of a larger
> "applications" initiative. This spec covers ONLY the core-extraction phase:
> standing up a shared `multi-step-flow` framework package. The applications
> feature itself (entity, engine, runner, review, email) and the funnel
> migration are **deferred to their own specs** — see [Deferred work](#deferred-work).

## Context & motivation

We are about to build an **applications** feature: agent-run, in-home promotion
applications (starting with the *TPR Assistance Program*, plus a stubbed
*Showcase Promotion*) that feel like the marketing funnels — a landing page that
explains the promotion, one page per question, next/back navigation, a summary,
and a confirmation — but that persist to the database, are linked to a meeting,
and are reviewed/approved by the office or the assigned agent.

The applications engine and the existing funnels engine are two instances of the
**same underlying idea**: a *multi-step flow* — an ordered, optionally-branching
sequence of question "steps" over a shared answer state, with a landing view, a
per-step view with next/back, and a terminal view. The funnels engine already
implements this cleanly, but every piece is named and typed against "funnel," and
one concern (localStorage persistence) is hard-wired into the state machine.

Rather than fork the funnels engine wholesale (which would duplicate the
framework and let the two copies drift), we extract the **framework** — the
generic, reusable infrastructure — into a shared package that *any* multi-step
engine can build on. The concrete **steps** are deliberately **not** shared: the
funnel's steps (PII, ZIP-gate, address, trade card-select) are not reusable by
applications, and applications' steps (numeric tenure, birthdate, conditional
email, multi-select trades, ZIP funding-check animation, "why us" long-text,
summary) are new and application-specific. Each engine owns its steps; both stand
on the shared framework.

### First principles — what a multi-step-flow engine intrinsically is

Independent of funnels or applications:

1. **A config object** declaring an ordered list of steps (each `{ id, kind }`),
   optional branching (`next(answers, currentId) → id`), and which step is the
   landing / which is terminal.
2. **A step contract** — a `kind → component` registry where every step component
   receives identical props (`value, setValue, answers, advance, back, ctx …`),
   generic over *whatever* kinds and *whatever* context a given engine defines.
3. **A state machine** — `{ currentStepId, history[], answers{} }` with
   `advance / back / reset / hasNext`, next computed via `next() ?? linearNext`.
   It knows nothing about *where* state is stored.
4. **A persistence adapter** — `load / persist / hydration`. The only thing that
   differs between a localStorage-backed engine and a DB-backed engine.
5. **A slotted shell** — landing → steps → terminal, a progress indicator,
   next/back nav, step transitions; with slots for engine-specific chrome.
6. **UI + lib + hook helpers** — the `Block` compound, a progress bar, motion
   tokens, `linearNext`, scroll helpers, option-authoring helpers.

Items 1–6 are the shared framework. **Steps are not part of it.**

## Goals

- Stand up `src/shared/domains/multi-step-flow/`: a neutral, framework-level
  package housing the shared multi-step infrastructure, extracted and generalized
  from the funnels engine's proven patterns.
- Move the `Block` compound to `src/shared/components/block/` (it is already a
  context-free, RSC-safe UI primitive).
- Keep the API **conservative** — generalize only what the two known consumers
  (funnels today, applications next) provably need. No speculative options/slots.
- Leave the funnels engine **untouched and behaviorally identical** this phase.
- Validate the package via a minimal in-repo **reference flow** that can be
  smoke-tested manually in dev, plus clean `pnpm tsc` and `pnpm lint`.

## Non-goals (this phase)

- **Not** refactoring the funnels engine to consume the package (deferred).
- **Not** building the applications entity, engine, runner, review UI, or email.
- **Not** introducing a test suite (the repo has none). Validation is
  type-check + lint + manual smoke via the reference flow.
- **Not** changing any funnel behavior, routes, measurement, or copy.

## Naming & semantics

The package must be semantically clear and carry **no "funnel" language**. Every
funnel-named identifier that moves is renamed to a neutral term:

| Funnel name | Neutral name |
|---|---|
| `FunnelSpec` | `FlowConfig` |
| `FunnelStep` | `Step` (union owned per-engine; `BaseStep<K>` in core) |
| `FunnelAnswers` | `StepAnswers` |
| `FunnelContext` | (per-engine ctx type param — core does not name it) |
| `useFunnelEngine` | `useStepEngine` |
| `FunnelEngineApi` | `StepEngineApi` |
| `FUNNEL_TRANSITION` / `FUNNEL_*` motion | `STEP_TRANSITION` / `STEP_*` |
| `defaultLinearNext` | `linearNext` |
| `scrollFunnelToTop` | `scrollToTop` (target-aware) |
| `FunnelProgress` | `StepProgress` |
| `funnel-engine.tsx` shell | `StepShell` |

`StepId`, `StepProps`, `StepKind`, `StepRegistry`, `AnswerByKind`, `ContentByKind`
are already neutral in the funnels code and carry over as-is.

CSS scopes (`.funnel-light`, `.funnel-grid-bg`), storage keys (`funnelStateKey`),
`data-funnel`, slugs, and the slug→spec registry are **funnel-specific** and stay
in `domains/funnels/`. They are not part of the shared framework.

## Architecture — package layout

```
src/shared/components/block/            # Block compound (lifted wholesale)
  block.tsx                             #   Object.assign(BlockRoot, { Content, Decor, ... })
  block-root.tsx, block-variants.ts     #   + all slot components, cva variants
  block-content.tsx, block-decor.tsx, ...

src/shared/domains/multi-step-flow/
  types.ts                             # FlowConfig, BaseStep<K>, StepProps<Content,Answer,Ctx>,
                                       #   StepRegistry<Kinds>, StepPersistenceAdapter
  hooks/
    use-step-engine.ts                 # the reducer + injected persistence adapter
  lib/
    linear-next.ts                     # linearNext(steps, currentStepId)
    scroll-to-top.ts                   # scrollToTop(target?)
    card-options.ts                    # option-authoring helpers (img/icon/text/cardOptions)
  constants/
    step-motion.ts                     # STEP_TRANSITION, step/stagger/timeline variants
    layout.ts                          # rail/question max-width tokens (neutral names)
  ui/
    step-shell.tsx                     # slotted landing → steps → terminal shell
    step-progress.tsx                  # animated progress bar
    card-option.tsx                    # generic card-option primitive (presentational)
  example/                             # reference flow for manual smoke-test (see Validation)
    reference-flow.tsx
    reference-adapter.ts               # in-memory StepPersistenceAdapter
  README.md                            # what this is, how to build a consumer engine
```

> `example/` is a manual-verification artifact, not production code. It may be
> kept as living documentation or removed after the first real consumer (the
> applications engine) lands. It must not be imported by production surfaces.

## Component & type design

### The step contract (`types.ts`)

The core provides the **generic** contract; each engine supplies its own concrete
kind-maps and context type.

```ts
// Core — generic over the consumer's kinds, content, answer, and context types.
export interface BaseStep<K extends string> { id: StepId; kind: K }

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

// A consumer builds its own registry from its own kind → component map.
export type StepRegistry<Kinds extends string> = Record<Kinds, ComponentType<StepProps<any, any, any>>>

export interface FlowConfig<Step extends BaseStep<string>, Ctx> {
  steps: Step[]
  /** Optional branching; falls back to linearNext when absent. */
  next?: (answers: StepAnswers, currentStepId: StepId) => StepId | null
  /** Which step kinds render as landing / terminal views (defaults: first step = landing). */
  landingStepId?: StepId
  terminalKinds?: readonly string[]
}
```

- Each engine keeps its own `AnswerByKind` / `ContentByKind` lockstep maps and its
  own discriminated `Step` union and `Ctx` shape — exactly as the funnels engine
  does today, just parameterized instead of hard-referenced.
- The **one documented cast** at the dispatch seam (registry lookup → component)
  carries over from the funnels engine.

### The state machine (`hooks/use-step-engine.ts`)

Pure reducer over `{ currentStepId, history, answers }`, identical to the current
funnel engine minus the localStorage binding. Persistence is injected:

```ts
export interface StepPersistenceAdapter<State> {
  load: () => State | null            // funnels: localStorage · applications: DB draft snapshot
  persist: (next: State) => void      // funnels: localStorage · applications: debounced DB autosave
  useHydration?: () => boolean        // sync (localStorage) vs async (DB load) hydration gate
}

export function useStepEngine<Step extends BaseStep<string>, Ctx>(
  config: FlowConfig<Step, Ctx>,
  adapter: StepPersistenceAdapter<EngineState>,
): StepEngineApi { /* advance/back/reset/hasNext/history/answers */ }
```

- `advance` computes next via `config.next ?? linearNext`, pushes history, and
  invokes an **optional** scroll callback (not hard-wired to `window`; target-aware
  so an authenticated panel can scroll its container).
- Hydration gate generalizes the funnel engine's SSR-vs-client mismatch handling;
  the localStorage adapter loads synchronously, a DB adapter loads asynchronously.

### The shell (`ui/step-shell.tsx`)

A slotted, headless-ish scaffold owning the generic structure only:

- Computes `view = landing | steps | terminal` from the engine + config.
- Boundary `AnimatePresence` (opacity crossfade) between views so `position:fixed`
  chrome stays viewport-anchored.
- `steps` view: `StepProgress` + a fixed-height internally-scrolling stage + inner
  `AnimatePresence mode="wait"` keyed on step id + next/back nav.
- **Slots** for engine-specific chrome: `renderStep`, `header`, `footer`,
  `background`, `landing`, `terminal`. Funnels (later) pass their hero/parallax +
  blueprint-grid + marketing landing; applications (later) pass a simple
  "explain the promotion + Start" landing and its own header/footer.
- Only slots the two known consumers need are added. No speculative slots.

### `Block` compound (`src/shared/components/block/`)

Lifted wholesale — it is already RSC-safe and imports only `cn`. No structural
change; docblocks de-funnel'd. `--block-*` CSS tokens are already neutral. If the
authenticated application chrome later needs an extra `surface`/`size` variant,
that is an additive change made by the consumer's spec, not part of this phase.

## Data flow

```
Consumer engine (funnels | applications)
  ├─ owns: Step union, AnswerByKind/ContentByKind, Ctx, StepRegistry, step components, specs
  ├─ builds: StepPersistenceAdapter (localStorage | DB autosave)
  └─ renders: <StepShell config engine ... slots> using useStepEngine(config, adapter)
                    │
                    ▼
Core (multi-step-flow)
  useStepEngine ──► reducer {currentStepId, history, answers} ──► adapter.persist(state)
        │                                                              ▲
        └─ advance/back via config.next ?? linearNext                  │
  StepShell ──► view(landing|steps|terminal) ──► registry[kind] dispatch
```

- Answers accumulate in the engine's `answers` map keyed by step id; each step
  calls `setValue`. The adapter persists the whole engine state.
- The core never reads or writes a store directly; it only calls the adapter.

## Error handling

- **Spec drift** (a persisted `currentStepId` no longer in `config.steps`): the
  engine falls back to the first step, mirroring the funnel engine's guard.
- **Adapter load failure / empty**: engine initializes from `config.steps[0]`.
- **Hydration mismatch**: the hydration gate renders the default initial state on
  first paint, then swaps to loaded state after mount.
- The core throws no runtime errors for missing optional config (`next`, slots);
  it degrades to linear progression and empty slots.

## Validation (no test suite)

The repo has no testing framework, so validation is:

1. `pnpm tsc` — clean (the generic types compile and infer correctly).
2. `pnpm lint` — clean (antfu config; arrow-parens, import order, etc.).
3. **Reference flow** (`example/`): a minimal 4-view flow — landing → 2 trivial
   steps → terminal — wired through `StepShell` with an in-memory
   `StepPersistenceAdapter`. Manually smoke-tested in dev: forward/back nav works,
   answers persist across back-nav, progress advances, transitions render, the
   hydration gate does not flash. Rendered via a dev-only route or scratch page,
   not linked from production navigation.
4. **Funnels regression check**: because funnels is untouched, a quick manual
   pass on one live funnel confirms no incidental breakage from the `Block`
   relocation (the only funnel-touching change — see below).

## Blast radius

The only change that touches funnel code this phase is the **`Block` relocation**
from `src/shared/domains/funnels/ui/block/` to `src/shared/components/block/`.
Every funnel import of `Block` (marketing blocks in `funnels/ui/blocks/*.tsx` and
elsewhere) is repointed to the new path. This is a mechanical import rewrite with
no behavioral change. Everything else in the package is net-new code with no
consumers yet, so it cannot regress existing surfaces.

> Alternative considered: leave `Block` in place and re-export from the new path.
> Rejected — a single canonical location is cleaner and the import rewrite is
> trivial and mechanical. If the rewrite proves noisy, a temporary re-export
> shim from the old path is an acceptable fallback during the migration.

## Deferred work

Each gets its own brainstorm → spec → plan cycle:

1. **Applications data model + backend** — `applications` entity (no `ownerId`;
   visibility via `userParticipatesInMeeting(userId, applications.meetingId)`),
   `type`/`status` enums, `draftAnswersJSON` (draft only), decision snapshot
   columns with `CHECK` constraints, `application_answers` child table
   (`UNIQUE(applicationId, questionKey)`, written on submit via the draft–commit
   split), `x_application_trades` junction. Follows ADR-0005 + the entity server
   system. Many applications per meeting; `meetingId` NOT NULL, `onDelete: cascade`.
2. **TPR Assistance engine + runner** — a fresh consumer of `multi-step-flow`
   with its own steps (numeric tenure, birthdate/date, conditional email when
   `customer.email` is empty, multi-select trades, ZIP funding-check animation,
   "why us" long-text, summary, confirmation), a DB-autosave adapter, and an
   agent-first `/applications` area (start-new = landing view for the agent; the
   homeowner engages only after the draft is created and linked to a meeting).
   Includes the **Showcase Promotion stub** (landing + placeholder steps +
   confirmation).
3. **Review queue + approval email** — pending/past queues, a review panel
   (answer summary + discount toggle percentage/absolute + incentives free-text
   with trade-aware quick-insert badges), Approve/Reject, and an approval email
   to the meeting's participants. Incentive catalog brainstormed separately
   (trade-aware; handoff prompt already drafted).
4. **Funnel migration** — refactor the funnels engine to consume
   `multi-step-flow` (behavior-preserving), retiring its private copies of the
   engine/shell/motion/progress and swapping in a localStorage adapter. This is
   what fully realizes "affect one, affect all."

## Open follow-ups (non-blocking)

- ⚠️ Stale ref to fix opportunistically: `docs/programs/README.md:83` points to
  `src/features/meetings/constants/programs.ts`; the code actually lives at
  `src/features/meeting-flow/constants/programs.ts`.

## Last updated

2026-07-29 — initial design (Phase 1: multi-step-flow core extraction).
