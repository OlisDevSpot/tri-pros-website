# TPR Assistance — Engine + Runner — Design Spec

> **Status:** Design approved 2026-07-30 (brainstorming). **Sub-project #2 of 4**
> in the applications initiative. Builds the first real consumer of the
> `multi-step-flow` framework (#1 shipped the framework; the applications entity
> backend also shipped in #1). Review queue + decision + email (#3) and funnel
> migration (#4) remain deferred.

## Context & motivation

Sub-project #1 delivered (a) the neutral `multi-step-flow` framework and (b) the
`applications` entity backend (`create`/`saveDraft`/`submit`/`withdraw`, the
`draftAnswersJSON` ↔ `ApplicationDraft` seam, the `TRADES_QUESTION_KEY` →
`x_application_trades` split, meeting-participation visibility). Nothing renders
yet.

This sub-project builds the **TPR Assistance Program** application: an
**agent-started, homeowner-self-served, in-home** flow that *feels* like the
marketing funnels but persists to the DB via the applications backend. It is the
first real `multi-step-flow` consumer and will surface (and satisfy) the small
framework gaps a real consumer needs.

**The offer** (canonical: `docs/marketing/assistance-offer.md`): Tri Pros helps
SoCal homeowners **qualify for home-upgrade assistance** — manufacturer credits,
state energy-efficiency funds, senior programs — that reduce the price of
**Title-24 green upgrades** (roofing, windows, insulation, HVAC, drought
landscaping, cool-coat exterior). The application **is a qualification intake**:
every question is a real criterion, and the ZIP funding-check is the emotional
peak.

## Goals

- Stand up `src/features/applications/`: the TPR Assistance runner as a
  `multi-step-flow` consumer — its step kinds/components, `FlowConfig`, a
  DB-autosave `StepPersistenceAdapter`, and the agent-first `/dashboard/applications`
  route.
- Reuse the funnels' proven pieces (the `ZipCheckProgress` animation, ZIP
  resolve/service-area helpers, card primitives, motion tokens, `Block`, the
  `.theme-marketing` scoped light theme) without importing funnel-domain steps.
- Make the flow a **qualification story**, qualification-framed per the offer
  guardrails (no guaranteed amounts; no exact income in the self-serve flow).
- Add the **one conservative framework extension** a real consumer needs: a
  per-step footer override on `StepShell` (for the self-advancing funding-check
  and the summary's async Submit).
- Include a **minimal Showcase stub** (`type: 'showcase'` → landing + one
  placeholder step + confirmation) proving the runner switches `FlowConfig` by
  `application.type`.
- Validate with `pnpm tsc` + `pnpm lint` + a manual dev browser smoke.

## Non-goals (this phase)

- **No** review queue, decision columns, approve/reject, or email (→ #3).
- **No** funnel migration onto `multi-step-flow` (→ #4).
- **No** backend schema change — the applications entity already supports this
  flow. (One doc-only wording generalization only; see [Trades-seam](#trades-seam-generalization).)
- **No** exact-income question; **no** hard rent/ownership dead-end branch this
  phase (rent is captured and left to the agent).
- **No** new test suite (repo has none).

## Decisions ratified (2026-07-30 brainstorming)

| Question | Ruling |
|---|---|
| Who operates the flow | **Agent starts, homeowner self-serves** on the agent's device |
| Route / entry | Top-level **`/dashboard/applications/[applicationId]`**; launch action on the meeting surface |
| ZIP funding-check | **Theatrical** on the meeting's **known ZIP** (no input), auto-advances |
| Trades/upgrades UX | **Premium multi-select card grid** |
| Green-upgrade source | **Curated in-code Assistance list** (NOT Notion) — junction `tradeId` holds a stable **slug** + name snapshot |
| Income | **Omitted** from the flow (agent review) |
| Showcase | **Minimal stub** |

## Architecture — feature layout

```
src/features/applications/                     # client feature (peer of meeting-flow/, intake/)
  constants/
    green-upgrades.ts                          # curated catalog: { slug, name, icon, blurb }[] (~6)
    tpr-assistance-flow.ts                     # FlowConfig<AssistanceStep, AssistanceCtx>
    showcase-flow.ts                           # minimal stub FlowConfig
  lib/
    kinds.ts                                   # Kind union + AnswerByKind/ContentByKind + AssistanceCtx
    flow-registry.ts                           # application.type → FlowConfig + StepRegistry
    use-application-db-adapter.ts              # StepPersistenceAdapter<EngineState> over draft.save
  ui/
    application-runner.tsx                     # reads app+meeting, builds ctx, renders <StepShell>
    steps/
      ownership-step.tsx  tenure-step.tsx  household-step.tsx  birthdate-step.tsx
      email-step.tsx  upgrades-step.tsx  funding-check-step.tsx  notes-step.tsx
      summary-step.tsx
    landing/assistance-landing.tsx             # StepShell `landing` slot (homeowner promo)
    terminal/assistance-confirmation.tsx       # StepShell `terminal` slot
    start-application-button.tsx               # launch action for the meeting surface

src/app/(frontend)/dashboard/applications/[applicationId]/page.tsx   # server prefetch + HydrateClient

src/shared/domains/multi-step-flow/ui/step-shell.tsx                 # + per-step footer override (additive)
```

## The `multi-step-flow` consumer wiring

### Kinds, answers, content (`lib/kinds.ts`)

```ts
type AssistanceKind =
  | 'ownership' | 'tenure' | 'household' | 'birthdate' | 'email'
  | 'trades' | 'funding-check' | 'notes' | 'summary' | 'confirmation'

interface AnswerByKind {
  ownership: 'own' | 'rent'
  tenure: number
  household: number
  birthdate: string            // ISO date
  email: string
  trades: { tradeId: string, tradeName: string }[]
  notes: string                // optional; pre-seeded '' so it can be skipped
  // funding-check, summary, confirmation collect NO answer (content-only)
}

interface AssistanceCtx {
  applicationId: string
  meetingId: string
  customerFirstName: string | null
  customerHasEmail: boolean
  zip: string | null
  city: string | null
}
```

- **Answer keys = step ids.** The engine keys `answers` by step id, and
  `submitApplication` commits each non-trades answer to `application_answers`
  with `questionKey = stepId`. Therefore the upgrades step's **id is
  `'trades'`** (= `TRADES_QUESTION_KEY`) so its value routes to the junction;
  `funding-check`/`summary`/`confirmation` store no answer, so they produce no
  rows.

### Steps (order + framing)

1. **Landing** (`StepShell` slot, not a step) — the assistance pitch + "See if
   you qualify." Agent hands the device here.
2. **ownership** — card-select `own | rent` ("Do you own your home?").
3. **tenure** — number ("How many years have you lived here?").
4. **household** — number ("How many people live in your home?").
5. **birthdate** — date ("Your date of birth" — *"some assistance is reserved
   for seniors"*).
6. **email** — text, **conditional** (only when `!ctx.customerHasEmail`) —
   "Best email for your results?"
7. **trades** (upgrades) — multi-select card grid over `green-upgrades.ts`;
   value = `{ tradeId: slug, tradeName }[]`.
8. **funding-check** — self-advancing `ZipCheckProgress` on `ctx.zip` + chosen
   upgrades ("Checking assistance funds available in [ZIP]…"); calls
   `engine.advance()` on complete. No default nav, no answer.
9. **notes** — optional free-text ("Anything about your home we should
   know?"); pre-seed `''` so Next is enabled and the step is skippable.
10. **summary** — read-only review of the answers; owns its footer: **Back** +
    **Submit my qualification** → `applicationsRouter.draft.submit` → on success
    `engine.advance()` to confirmation.
11. **confirmation** (`terminalKinds: ['confirmation']`) — "You're in review —
    we're matching you to available assistance and confirming your
    qualification; your Tri Pros specialist will follow up."

### Branching (`config.next`)

Linear, except: **skip `email`** when `ctx.customerHasEmail`. (`config.next`
returns the step after `birthdate` = `trades` in that case.) No other branches
this phase.

### Registry + config

`flow-registry.ts` maps `application.type` → `{ config, registry, landing,
terminal }`. `tpr-assistance-flow.ts` builds the `FlowConfig` above;
`showcase-flow.ts` is the minimal stub (landing + one card-select placeholder +
confirmation). The runner selects by type.

## The DB-autosave adapter (`lib/use-application-db-adapter.ts`)

```ts
function useApplicationDbAdapter(
  applicationId: string,
  initialDraft: ApplicationDraft | null,   // from the prefetched application row
): StepPersistenceAdapter<EngineState>
```

- **`load()`** returns the current engine-state snapshot: the prefetched
  `initialDraft` (stripped of `_v`) or `null` — synchronous, safe.
- **`persist(next)`** debounces (~700ms) a `applicationsRouter.draft.save`
  mutation with `state = { _v: 1, ...next }`. Fire-and-forget from the engine's
  view; a failed save is retried on the next change (autosave is not a
  correctness boundary — submit is).
- **`useHydration()`** returns whether the application query has resolved. The
  page prefetches the application (SSR) and `HydrateClient` seeds the cache, so
  in practice this is `true` on first client render — but the seam is honored so
  a cold client load doesn't flash `initial` state.
- The adapter bridges `EngineState { currentStepId, history, answers }` ↔
  `ApplicationDraft { _v, currentStepId, history, answers }` (the `_v` envelope).

**Resume is automatic:** reopening `/dashboard/applications/[id]` reloads
`draftAnswersJSON` and the engine resumes at `currentStepId`.

## Framework extension — per-step footer override (`StepShell`)

`StepShell` today renders a default Back/Next row in the steps view, with Next
gated on `engine.value != null`. Two steps need to opt out:

- **funding-check** — a self-advancing animation: no nav at all.
- **summary** — an async **Submit** that calls the backend, then advances.

Add one conservative, additive prop:

```ts
// StepShell props (new, optional)
stepFooter?: (engine: StepEngineApi) => ReactNode | null
```

- Returns `null` → `StepShell` renders its **default** Back/Next (unchanged
  behavior; all other steps).
- Returns a node (including an empty fragment) → `StepShell` renders **that
  instead** of the default nav for the current step.

The Assistance consumer passes a `stepFooter` that returns: an empty fragment
for `funding-check`; a `<Back/> + <SubmitButton/>` for `summary`; `null`
otherwise. This is purely additive — funnels don't consume `StepShell` yet, so
there is zero funnel impact. It matches Phase 1's rule ("add only what a known
consumer needs").

## Route + entry (`/dashboard/applications`)

- **Launch:** `start-application-button.tsx` on the meeting surface (meeting
  detail / meeting-flow), agent-gated, calls
  `applicationsRouter.crud.create({ type: 'tpr_assistance', meetingId })` then
  `router.push('/dashboard/applications/' + created.id)`.
- **Runner page** (`[applicationId]/page.tsx`, `dynamic = 'force-dynamic'`):
  `protectDashboardPage()` → `prefetch` the application **row** (`crud.getById`
  — carries `draftAnswersJSON` for the adapter's initial load) **and** the
  meeting (`meetingsRouter.reads.getByIdWithJoins`) → `HydrateClient` →
  `<ApplicationRunner applicationId={…} />`. (`getWithAnswers` is #3's
  post-submit read, not the draft-load path.)
- **Runner** reads the hydrated application + meeting, derives `AssistanceCtx`
  (`customer.email` presence, ZIP/city, first name), picks the flow by
  `application.type`, and renders `<StepShell>` wrapped in `.theme-marketing`
  (re-asserting `text-foreground`, per the funnel-layout precedent).

## Data flow

```
Agent (meeting surface) ─ crud.create{type,meetingId} ─► /dashboard/applications/[id]
Runner ─ getByIdWithJoins(meeting) ─► AssistanceCtx (email?, zip, name)
       ─ useStepEngine(flowConfig, dbAdapter, {onNavigate}) ─► <StepShell theme=marketing ...slots>
Homeowner steps ─ setValue ─► engine.answers ─ persist(debounced) ─► draft.save → draftAnswersJSON
Summary Submit ─ draft.submit ─► commit answers→application_answers + trades→x_application_trades
             └─ engine.advance() ─► confirmation (terminal)
```

## Error handling

- **Autosave failure**: silent + retried on next change (fire-and-forget). Not a
  data-loss risk for a short session; submit is the durable boundary.
- **Submit failure**: toast the mapped tRPC error, stay on the summary step,
  keep the draft intact (submit is transactional server-side).
- **Missing meeting/customer data**: the runner degrades — a null ZIP makes the
  funding-check play a generic "checking your area" beat; a null email always
  shows the email step.
- **Hydration**: the adapter's `useHydration` gate prevents an SSR/client flash;
  spec-drift (a persisted `currentStepId` not in the config) already falls back
  to the first step in the engine.
- **Rent answer**: captured, no hard dead-end; the agent handles eligibility in
  review (#3).

## Trades-seam generalization (doc-only)

The Assistance flow stores curated **slugs** (not Notion UUIDs) in
`x_application_trades.tradeId` (a `text` column — already FK-free after #1's
fix). This phase makes a **doc-only** wording update so the backend stays honest:
`src/shared/db/schema/x-application-trades.ts`'s comment and
`applications/DOCS.md#trades-question-key-seam` generalize "Notion page UUID" →
"the flow's trade identifier (a Notion page UUID for catalog-backed flows, or a
curated slug for the Assistance green-upgrade flow) + a name snapshot." No schema
or logic change. See memory `reference-trades-notion-vs-postgres`.

## Validation (no test suite)

1. `pnpm tsc` + `pnpm lint` — clean.
2. **Manual dev browser smoke** (mirrors Phase 1): against a real dev meeting
   with a participant, launch → step through the full flow → reload mid-flow and
   confirm it **resumes** at the same step with answers intact (autosave) →
   Submit → confirmation; verify in the DB that `application_answers` rows +
   `x_application_trades` rows (slug + name) landed and no trades leaked into
   answers. Also confirm the email step is **skipped** when the customer already
   has an email, and shown when not.
3. Confirm the funnels still render (the only shared-package change is the
   additive `StepShell` prop; funnels don't consume `StepShell`).

## Blast radius

Almost entirely additive: a new `src/features/applications/` feature and a new
route. Shared touches are minimal and additive: (a) the optional `stepFooter`
prop on `StepShell` (no existing consumer), (b) a small launch button on the
meeting surface, (c) the doc-only trades-seam wording. No backend schema change,
no funnel change, no change to the applications DAL/tRPC.

## Deferred to later sub-projects

- **#3 — review + email**: decision columns + approve/reject + pending/past
  queues + review panel + approval email. Reads `getApplicationWithAnswers`
  (answers + `trades` with name snapshots) — already built in #1.
- **#4 — funnel migration**: refactor funnels onto `multi-step-flow`
  (behavior-preserving), retiring the bespoke funnel engine/shell.

## Last updated

2026-07-30 — initial design (sub-project #2: TPR Assistance engine + runner).
