# Applications — Data Model + Backend — Design Spec

> **Status:** Design approved 2026-07-30 (brainstorming). This is **sub-project #1
> of 4** in the applications initiative (see the core-extraction spec's
> [Deferred work], 2026-07-29). It covers ONLY the `applications` entity's data
> model and backend: schema, enums, the draft→commit split, DAL, service, tRPC,
> and visibility. The runner/engine UI (#2), review queue + approval email (#3),
> and funnel migration (#4) are **deferred to their own specs**.

## Context & motivation

The applications feature is agent-run, in-home promotion applications (starting
with the *TPR Assistance Program*; *Showcase Promotion* stubbed) that feel like
the marketing funnels but **persist to the database**, are **linked to a
meeting**, and are **reviewed/approved** by the office or the assigned agent.

Phase 1 (2026-07-29) extracted the shared `multi-step-flow` framework. This
sub-project stands up the **persistence substrate** the applications engine will
autosave into and submit through — before any UI exists. It is a pure
backend/data-model slice: nothing renders yet.

The design deliberately mirrors the **proposals** entity, which already solves
the same problems: a draft blob that commits to typed child rows, visibility
inherited from a linked meeting (not an owner column), and the entity-server
system (one `EntityServerSpec` feeding both `createCrudDal` and
`createEntityRouter`).

## Goals

- Stand up the `applications` entity end-to-end at the data + backend layers,
  following the entity-server system, ADR-0005, and the enum/DAL/service/tRPC
  conventions verbatim.
- Model the **draft→commit split**: an in-progress engine-state blob
  (`draftAnswersJSON`) that commits to a `application_answers` child table and an
  `x_application_trades` junction on submit.
- Gate visibility purely through **meeting participation** — no `ownerId`.
- Expose exactly the backend the engine (#2) needs: **create · saveDraft ·
  submit · withdraw**, plus reads/list. Nothing more.
- Validate with `pnpm tsc` + `pnpm lint` + a `SYSTEM_CONTEXT` smoke script
  against the **dev** DB. No test suite (the repo has none); no UI this phase.

## Non-goals (this phase)

- **No** review UI, approve/reject mutation, decision columns, or approval email
  (all → sub-project #3).
- **No** author/`createdById` column (visibility is meeting-participation only;
  ruled 2026-07-30).
- **No** question-label snapshot on committed answers (the review panel resolves
  prompts from the live step registry; ruled 2026-07-30).
- **No** engine, steps, adapter, or `/applications` route (→ sub-project #2).
- **No** change to funnels, proposals, or any existing surface.

## Decisions ratified (2026-07-30 brainstorming)

| Question | Ruling |
|---|---|
| Lifecycle | `draft → submitted → approved/rejected` **+ `withdrawn`** (5 states) |
| Committed answer value | single `value` **text** column; **no** label snapshot |
| Decision snapshot columns | **deferred to #3** (not in this migration) |
| Author column | **none** — visibility via meeting participation only |
| Backend surface | **create · saveDraft · submit · withdraw** (+ reads/list) |
| `withdraw` transition | **wired this phase** (trivial status flip + guard) |
| Post-submit `draftAnswersJSON` | **kept** (inert record); `saveDraft` gated to `status='draft'` |

## Naming & semantics

Entity name: **`applications`** (plural table, singular domain concept
"application"). Entity const `APPLICATION = 'application'` in
`entities/applications/lib/constants.ts` (mirrors `PROPOSAL`).

No "funnel" language anywhere. An application *step*/*answer*/*flow* uses the
neutral `multi-step-flow` vocabulary from Phase 1.

## Architecture — file layout

```
src/shared/constants/enums/applications.ts       # applicationTypes, applicationStatuses (as-const tuples)
src/shared/types/enums/applications.ts           # derived union types
  (+ barrel re-exports in constants/enums/index.ts and types/enums/index.ts)

src/shared/db/schema/applications.ts             # parent table + relations + drizzle-zod
src/shared/db/schema/application-answers.ts       # committed-answer child table
src/shared/db/schema/x-application-trades.ts      # trades junction
  (+ register all three in src/shared/db/schema/index.ts)

src/shared/entities/applications/
  DOCS.md                    # business rules (anchored ### rule-slug sections)
  types.ts                   # ApplicationDraft (engine-state blob shape)
  schemas/index.ts           # applicationDraftSchema (Zod, _v-versioned)
  lib/
    constants.ts             # APPLICATION, TRADES_QUESTION_KEY
    visibility.ts            # applicationVisibility(userId) => SQL
    server-spec.ts           # applicationServerSpec: EntityServerSpec
  dal/server/
    crud.ts                  # createCrudDal(applicationServerSpec)  (no barrel)
    queries.ts               # list + getWithAnswers reads
    mutations.ts             # saveDraft, submitApplication, withdraw

src/trpc/routers/applications.router/
  index.ts                   # createEntityRouter(...) + business procedures
  (+ register in src/trpc/routers/app.ts)

scripts/tmp-smoke-applications-backend.ts        # SYSTEM_CONTEXT smoke (delete after validation)
```

## Data model

### Enums (`src/shared/constants/enums/applications.ts`)

```ts
export const applicationTypes = ['tpr_assistance', 'showcase'] as const
export const applicationStatuses = ['draft', 'submitted', 'approved', 'rejected', 'withdrawn'] as const
```

- Storage is `text('col', { enum: ... })` — **not** `pgEnum` (Closed Vocabulary
  Standard; no DB-side consumer exists). Union types derive in
  `types/enums/applications.ts` via `(typeof X)[number]`.
- `approved`/`rejected` are defined now (closed vocabulary) but **no mutation
  writes them this phase** — the decision backend is #3.

### `applications` (parent) — `src/shared/db/schema/applications.ts`

```ts
export const applications = pgTable('applications', {
  id,
  type: text('type', { enum: applicationTypes }).notNull(),
  status: text('status', { enum: applicationStatuses }).notNull().default('draft'),

  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),

  // In-progress engine-state snapshot: { _v, currentStepId, history, answers }.
  // The DB-autosave StepPersistenceAdapter (sub-project #2) load/persists THIS.
  // Scratch only — committed answers become the source of truth on submit.
  // Sparse + fetched-whole ⇒ JSONB is correct per ADR-0005. Nullable until the
  // engine's first autosave. Zod-validated at the write boundary.
  draftAnswersJSON: jsonb('draft_answers_JSON').$type<ApplicationDraft>(),

  submittedAt: timestamp('submitted_at', { mode: 'string', withTimezone: true }),
  createdAt,
  updatedAt,
}, table => [
  // Any post-draft, non-withdrawn status implies a submission happened.
  // (#3 tightens this when approved/rejected transitions land.)
  check(
    'applications_submitted_at_ck',
    sql`${table.status} IN ('draft', 'withdrawn') OR ${table.submittedAt} IS NOT NULL`,
  ),
])
```

- `meetingId` **NOT NULL**, `onDelete: cascade` — many applications per meeting;
  deleting the meeting removes its applications (ruled in the core-extraction
  spec's deferred #1).
- No `ownerId`, no `customerId`, no `createdById`. The customer (and their
  email, for the conditional-email step) is reached through the meeting.
- `relations`: `meeting: one(meetings)`, `answers: many(applicationAnswers)`,
  `applicationTrades: many(x_applicationTrades)`.
- drizzle-zod `selectApplicationSchema` / `insertApplicationSchema`
  (`.omit({ id, createdAt, updatedAt })`), `draftAnswersJSON` overridden by
  `applicationDraftSchema`.

### `application_answers` (child, committed on submit) — `application-answers.ts`

The ADR-0005 "dynamic-key map" sub-entity: `UNIQUE(applicationId, questionKey)`.

```ts
export const applicationAnswers = pgTable('application_answers', {
  id,
  applicationId: uuid('application_id')
    .notNull()
    .references(() => applications.id, { onDelete: 'cascade' }),
  questionKey: text('question_key').notNull(),
  value: text('value').notNull(),           // stringified scalar; prompt+type resolved from the step registry
  position: integer('position').notNull(),  // display order, frozen from step order at commit
  createdAt,
  updatedAt,
}, table => [
  unique('application_id_question_key_unique').on(table.applicationId, table.questionKey),
])
```

- Read whole for the review panel (#3) — never filtered/sorted/aggregated at the
  DB — so `text` is correct per ADR-0005; typed columns would be over-engineering.
- **Trades are NOT stored here** — the multi-select-trades answer routes to the
  junction (below), which keeps trades joinable/aggregatable.

### `x_application_trades` (junction) — `x-application-trades.ts`

```ts
export const x_applicationTrades = pgTable('x_application_trades', {
  id: unsafeId,
  applicationId: uuid('application_id')
    .notNull()
    .references(() => applications.id, { onDelete: 'cascade' }),
  tradeId: integer('trade_id')
    .notNull()
    .references(() => trades.id, { onDelete: 'cascade' }),
}, table => [
  unique('application_id_trade_id_unique').on(table.applicationId, table.tradeId),
])
```

### The draft blob shape (`entities/applications/types.ts` + `schemas/index.ts`)

```ts
// types.ts
export interface ApplicationDraft {
  _v: number
  currentStepId: string
  history: string[]
  answers: Record<string, unknown>   // questionKey → raw answer (heterogeneous)
}
```

`applicationDraftSchema` (Zod) validates this at every write boundary
(`.$type<>()` is a compile-time no-op). `_v` starts at `1`; evolves via
expand-and-contract per `jsonb-columns.md`.

## Backend surface

Layering is strict: **tRPC → Service/DAL → db**. Only the DAL imports `db`.
Every DAL fn takes `ctx: ScopedContext` first and returns `Promise<DalReturn<T>>`.

### Visibility (`lib/visibility.ts`)

```ts
export function applicationVisibility(userId: string): SQL {
  return userParticipatesInMeeting(userId, applications.meetingId)
}
```

Wired into `applicationServerSpec.visibility`. Super-admins bypass (scope=null).
Child rows carry no independent visibility — they're written/read through the
scoped parent (mirrors `proposal_incentives`).

### Entity server spec (`lib/server-spec.ts`)

`applicationServerSpec: EntityServerSpec` — table + `visibility:
applicationVisibility` + hooks. `create.before` is minimal (status defaults to
`'draft'` via the column; `type` + `meetingId` come from input). No `after`
side effects this phase.

### CRUD (`dal/server/crud.ts`)

`export const applicationCrud = createCrudDal(applicationServerSpec)` — the five
fixed slots (`getById/create/update/delete/duplicate`). **create** is the
agent-starts-a-draft path (reuses the generic CRUD slot; no ad-hoc DAL —
`reuse-existing-api-surface`). `duplicate` is unused this phase.

### Business DAL (`dal/server/mutations.ts`)

```ts
// Autosave target. Debounced calls from #2's DB adapter.
saveDraft(ctx, { applicationId, state: ApplicationDraft }): Promise<DalReturn<Application>>
//   scope-probe parent → guard status === 'draft' → Zod-parse state → write draftAnswersJSON

// The commit. One db.transaction.
submitApplication(ctx, { applicationId }): Promise<DalReturn<Application>>
//   scope-probe parent → guard status === 'draft' → read draftAnswersJSON.answers →
//   split: reserved TRADES_QUESTION_KEY (value = tradeId[]) → x_application_trades rows;
//           every other key → application_answers via INSERT … ON CONFLICT
//             (applicationId, questionKey) DO UPDATE SET value, position (idempotent) →
//   set status='submitted', submittedAt = new Date().toISOString() →
//   draftAnswersJSON is LEFT INTACT (inert record).

// Trivial pre-decision abandon.
withdraw(ctx, { applicationId }): Promise<DalReturn<Application>>
//   scope-probe parent → guard status IN ('draft','submitted') → set status='withdrawn'
```

- `submittedAt` is written with JS `new Date().toISOString()` on a `mode:'string'`
  column — **not** raw SQL `NOW()` (`feedback-no-raw-sql-for-event-timestamps`).
- `saveDraft`/`submit`/`withdraw` never touch `updatedAt` in `.set()` —
  `$onUpdate` handles it.
- **The trades seam** — `TRADES_QUESTION_KEY` (in `lib/constants.ts`) is the one
  reserved answer key `submitApplication` special-cases. Phase #2's
  multi-select-trades step MUST write its selection under this exact key. This
  cross-phase contract is documented as an anchored rule in
  `applications/DOCS.md#trades-question-key-seam` so #2 can't drift.

### Business DAL reads (`dal/server/queries.ts`)

- `list(ctx, …)` — business list procedure (list is never a CRUD slot).
- `getWithAnswers(ctx, { applicationId })` — parent + `application_answers` +
  joined trades, for #3's review panel (defined now so #3 needs no new read).

### tRPC (`src/trpc/routers/applications.router/index.ts`)

```ts
createEntityRouter(applicationServerSpec, entity => createTRPCRouter({
  ...createCrudRouter({ spec, schemas, authedProcedure: entity.authedProcedure }),
  saveDraft: entity.authedProcedure.input(...).mutation(({ ctx, input }) => dalToTrpc(saveDraft(ctx, input))),
  submit:    entity.authedProcedure.input(...).mutation(({ ctx, input }) => dalToTrpc(submitApplication(ctx, input))),
  withdraw:  entity.authedProcedure.input(...).mutation(({ ctx, input }) => dalToTrpc(withdraw(ctx, input))),
  list:      entity.authedProcedure.input(...).query(({ ctx, input }) => dalToTrpc(list(ctx, input))),
}))
```

- `entity.authedProcedure = agentProcedure.use(scopeMiddleware(spec))` — every
  procedure agent-gated (agents run applications). Bodies are thin: parse → DAL →
  `dalToTrpc`.
- Registered in `src/trpc/routers/app.ts`; `registerEntity(applicationServerSpec)`
  fires at module load (duplicate registration throws).

## Data flow

```
Agent starts application  ──► applications.create { meetingId, type }  ──► status='draft'
Engine (#2) autosaves     ──► applications.saveDraft { applicationId, state }  ──► draftAnswersJSON
Homeowner/agent submits   ──► applications.submit { applicationId }
                                 └─ tx: answers ─► application_answers (ON CONFLICT)
                                        trades  ─► x_application_trades
                                        status='submitted', submittedAt=now
Agent abandons            ──► applications.withdraw { applicationId }  ──► status='withdrawn'
Review panel (#3)         ──► applications.getWithAnswers  (parent + answers + trades)
```

Visibility is enforced at every hop by `scopeMiddleware` → `ctx.scope` →
`userParticipatesInMeeting(userId, applications.meetingId)`.

## Error handling

- **Wrong-state guards**: `saveDraft`/`submit` require `status='draft'`;
  `withdraw` requires `status IN ('draft','submitted')`. Violations →
  `dalError({ type: 'precondition-failed' })` → tRPC `PRECONDITION_FAILED`.
- **Not a participant**: `ctx.scope` yields no row → `dalError({ type:
  'not-found' })` (scope makes non-participant rows invisible, not "forbidden").
- **Empty/malformed draft on submit**: null `draftAnswersJSON` or a Zod-parse
  failure → `precondition-failed` ("nothing to submit").
- **Unknown trade id** in the trades answer → FK violation surfaces as a DAL
  error; submit's transaction rolls back (no partial commit).
- **Idempotent re-run**: `INSERT … ON CONFLICT DO UPDATE` makes a re-submit of
  the same draft converge, not duplicate (defensive; the status guard already
  blocks the normal path).

## Validation (no test suite, no UI this phase)

1. `pnpm tsc` — clean (generics + drizzle-zod infer).
2. `pnpm lint` — clean (antfu).
3. `pnpm db:push:dev` — schema applies to the **dev** Neon branch.
4. `scripts/tmp-smoke-applications-backend.ts` (uses `import './lib/load-env'`
   and `SYSTEM_CONTEXT`): seed/find a meeting with a participant → `create` a
   draft → `saveDraft` a sample engine-state → `submit` → assert
   `application_answers` rows + `x_application_trades` rows populate,
   `draftAnswersJSON` is intact, `status='submitted'`, `submittedAt` set; then
   `withdraw` a second draft and assert `status='withdrawn'`. Delete the script
   after validation.

> Never run against prod. `DRIZZLE_TARGET` stays unset (dev) for the smoke.

## Blast radius

Entirely additive: three net-new tables, one net-new entity module, one net-new
router. Touches shared registries only by **appending**: `db/schema/index.ts`,
`constants/enums/index.ts`, `types/enums/index.ts`, `trpc/routers/app.ts`. No
existing table, entity, router, or surface is modified. Nothing consumes the new
backend yet (the engine is #2), so it cannot regress live behavior.

## Deferred to later sub-projects

- **#2 — engine + runner**: the TPR Assistance consumer of `multi-step-flow`
  (steps, the DB-autosave `StepPersistenceAdapter` that calls `saveDraft`, the
  agent-first `/applications` area), + Showcase stub. Must write the trades
  selection under `TRADES_QUESTION_KEY`.
- **#3 — review + email**: decision columns (discount kind/value, incentives
  free-text, `decidedById`, `decidedAt`) + CHECKs, the approve/reject mutation,
  pending/past queues, review panel, approval email. Tightens the
  `applications_submitted_at_ck` CHECK for the approved/rejected transitions.
- **#4 — funnel migration**: refactor funnels onto `multi-step-flow`.

## Last updated

2026-07-30 — initial design (sub-project #1: applications data model + backend).
