# Applications — Data Model + Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `applications` entity's data model and backend (schema, enums, permissions, DAL, service, tRPC, visibility) with a draft→commit split, consumed by nothing yet.

**Architecture:** Follows the entity-server system verbatim — one `EntityServerSpec` feeds both `createCrudDal(spec)` (DAL) and `createEntityRouter(spec, factory)` (tRPC). Draft state lives in a `draftAnswersJSON` blob; on submit it commits to an `application_answers` child table (dynamic-key map, `UNIQUE(applicationId, questionKey)`) and an `x_application_trades` junction. Visibility inherits from the linked meeting via `userParticipatesInMeeting` — no `ownerId`.

**Tech Stack:** Next.js 15 · tRPC v11 · Drizzle (Postgres/Neon) · drizzle-zod · Zod v4 · CASL · antfu ESLint.

**Canonical spec:** `docs/superpowers/specs/2026-07-30-applications-data-model-backend-design.md`. Read it for the *why*; this plan is the *how*.

## Global Constraints

Every task's requirements implicitly include these:

- **No test suite exists.** Per-task cycle = write code → `pnpm tsc` (clean) → `pnpm lint` (clean) → commit. Never run `pnpm build`. The final smoke script (Task 8) is the executable end-to-end validation.
- **antfu ESLint:** no semicolons, single quotes, 2-space indent, arrow-parens always, import order (types first, then value imports grouped), no unused. Run `pnpm lint:fix` to auto-fix layout before committing.
- **Named exports only** (no default exports anywhere in this plan). One primary export per file where practical.
- **No "funnel" language** in any identifier, comment, or doc — this is neutral application/`multi-step-flow` vocabulary.
- **Only the DAL imports `db`.** tRPC procedures and (future) services call DAL functions, never `db` directly.
- **Every DAL fn** takes `ctx: ScopedContext` first and returns `Promise<DalReturn<T>>`; it never throws for domain errors (use `throw new ThrowableDalError(...)` *inside* `dalDbOperation`). Explicit return-type annotation on every exported DAL fn.
- **Never set `updatedAt` manually** in `.set(...)` — `$onUpdate` handles it.
- **Event timestamps** (`submittedAt`) are written with JS `new Date().toISOString()` on the `mode: 'string'` column — never raw SQL `NOW()`.
- **JSONB writes are Zod-parsed at the write boundary** (`.$type<>()` is compile-time only, zero runtime validation).
- **Reuse the generic CRUD surface** — `create` is the generic `createCrudDal` slot; do not hand-write DAL that the five CRUD slots already cover. Business DAL is only `saveDraft`/`submitApplication`/`withdraw`/`list`/`getWithAnswers`.
- **Git:** stage explicitly by path (never `git add -A`). Commit messages end with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.
- **DB pushes hit dev only** (`pnpm db:push:dev`). Never `db:push:prod`. The smoke script leaves `DRIZZLE_TARGET` unset (dev) and must never run against prod.
- **Entity identity is PascalCase:** `APPLICATION = 'Application'` (mirrors `PROPOSAL = 'Proposal'`).

---

## File Structure

**New files:**
- `src/shared/constants/enums/applications.ts` — `applicationTypes`, `applicationStatuses` tuples.
- `src/shared/types/enums/applications.ts` — derived `ApplicationType`, `ApplicationStatus`.
- `src/shared/entities/applications/lib/constants.ts` — `APPLICATION`, `TRADES_QUESTION_KEY`.
- `src/shared/entities/applications/schemas/index.ts` — `applicationDraftSchema` + `ApplicationDraft` type.
- `src/shared/db/schema/applications.ts` — parent table + relations + drizzle-zod.
- `src/shared/db/schema/application-answers.ts` — committed-answer child table.
- `src/shared/db/schema/x-application-trades.ts` — trades junction.
- `src/shared/entities/applications/lib/visibility.ts` — `applicationVisibility`.
- `src/shared/entities/applications/lib/server-spec.ts` — `applicationServerSpec` + `applicationSchemas`.
- `src/shared/entities/applications/dal/server/crud.ts` — `applicationCrud`.
- `src/shared/entities/applications/dal/server/mutations.ts` — `saveDraft`, `submitApplication`, `withdraw`.
- `src/shared/entities/applications/dal/server/queries.ts` — `listApplications`, `getApplicationWithAnswers`, input schema.
- `src/trpc/routers/applications.router/index.ts` — `applicationsRouter`.
- `src/shared/entities/applications/DOCS.md` — business rules.
- `scripts/tmp-smoke-applications-backend.ts` — backend smoke (deleted after validation).

**Modified files (append-only):**
- `src/shared/constants/enums/index.ts` — re-export applications.
- `src/shared/types/enums/index.ts` — re-export applications.
- `src/shared/db/schema/index.ts` — export the three new tables.
- `src/shared/domains/permissions/abilities.ts` — import `APPLICATION`, add to `ENTITY_NAMES`, grant agent read/create/update.
- `src/trpc/routers/app.ts` — import + register `applicationsRouter`.

---

## Task 1: Register the Application subject + enums

**Files:**
- Create: `src/shared/entities/applications/lib/constants.ts`
- Create: `src/shared/constants/enums/applications.ts`
- Create: `src/shared/types/enums/applications.ts`
- Modify: `src/shared/constants/enums/index.ts` (append re-export)
- Modify: `src/shared/types/enums/index.ts` (append re-export)
- Modify: `src/shared/domains/permissions/abilities.ts`

**Interfaces:**
- Produces: `APPLICATION = 'Application'` and `TRADES_QUESTION_KEY = 'trades'` consts; `applicationTypes`, `applicationStatuses` readonly tuples; `ApplicationType`, `ApplicationStatus` union types; `'Application'` becomes a valid `EntityName`/`AppSubject` with agent read/create/update grants.

- [ ] **Step 1: Entity identity + reserved-key constants**

`src/shared/entities/applications/lib/constants.ts`:
```ts
/** Entity-name constant. Source of truth for `EntityName` / `AppSubject`. */
export const APPLICATION = 'Application' as const

/**
 * The one reserved answer key `submitApplication` special-cases: its value is
 * a `tradeId[]` that routes to `x_application_trades` instead of
 * `application_answers`. The multi-select-trades step (sub-project #2) MUST
 * write its selection under this exact key.
 * see ../DOCS.md#trades-question-key-seam
 */
export const TRADES_QUESTION_KEY = 'trades' as const
```

- [ ] **Step 2: Enum tuples (single source of truth)**

`src/shared/constants/enums/applications.ts`:
```ts
export const applicationTypes = ['tpr_assistance', 'showcase'] as const
export const applicationStatuses = ['draft', 'submitted', 'approved', 'rejected', 'withdrawn'] as const
```

- [ ] **Step 3: Derived union types**

`src/shared/types/enums/applications.ts`:
```ts
import type { applicationStatuses, applicationTypes } from '@/shared/constants/enums/applications'

export type ApplicationType = (typeof applicationTypes)[number]
export type ApplicationStatus = (typeof applicationStatuses)[number]
```

- [ ] **Step 4: Barrel re-exports**

Append to `src/shared/constants/enums/index.ts`:
```ts
export * from './applications'
```
Append to `src/shared/types/enums/index.ts`:
```ts
export * from './applications'
```
(Match the exact export style already in each barrel — if the file uses explicit named re-exports rather than `export *`, follow that; check the file first.)

- [ ] **Step 5: Make `Application` a permittable subject**

In `src/shared/domains/permissions/abilities.ts`:
1. Add the import alongside the other entity-constant imports (alphabetical among them):
```ts
import { APPLICATION } from '@/shared/entities/applications/lib/constants'
```
2. Add `APPLICATION` to the `ENTITY_NAMES` array (append before the closing `] as const`).
3. In the `case 'agent':` block, alongside the other entity grants (e.g. after the `Proposal` grants), add:
```ts
      can('read', 'Application')
      can('create', 'Application')
      can('update', 'Application')
```
(Agents run applications. No delete; decisions come in #3. Super-admin already covers all via `manage`/`all`.)

- [ ] **Step 6: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean. `'Application'` now type-checks as an `EntityName`/`AppSubject`.

- [ ] **Step 7: Commit**

```bash
git add src/shared/entities/applications/lib/constants.ts \
  src/shared/constants/enums/applications.ts src/shared/constants/enums/index.ts \
  src/shared/types/enums/applications.ts src/shared/types/enums/index.ts \
  src/shared/domains/permissions/abilities.ts
git commit -m "feat(applications): register Application subject + type/status enums

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Database schema — three tables

**Files:**
- Create: `src/shared/entities/applications/schemas/index.ts`
- Create: `src/shared/db/schema/applications.ts`
- Create: `src/shared/db/schema/application-answers.ts`
- Create: `src/shared/db/schema/x-application-trades.ts`
- Modify: `src/shared/db/schema/index.ts` (append three exports)

**Interfaces:**
- Consumes: `applicationTypes`/`applicationStatuses` (Task 1), `id`/`createdAt`/`updatedAt`/`unsafeId` from `schema-helpers`, `meetings`, `trades`.
- Produces: tables `applications`, `applicationAnswers`, `x_applicationTrades`; `applicationDraftSchema` + `ApplicationDraft`; `insertApplicationSchema`/`selectApplicationSchema` + `Application` type; child-row `$inferSelect`/`$inferInsert` types.

- [ ] **Step 1: Draft blob Zod schema (single source of truth for the type)**

`src/shared/entities/applications/schemas/index.ts`:
```ts
import z from 'zod'

/**
 * The in-progress engine-state snapshot persisted to `applications.draft_answers_JSON`.
 * This is exactly what sub-project #2's DB `StepPersistenceAdapter` load/persists.
 * `_v` is the schema version (expand-and-contract on change). `answers` is a
 * dynamic questionKey → raw-value map (heterogeneous; committed to child rows on submit).
 */
export const applicationDraftSchema = z.object({
  _v: z.number().int(),
  currentStepId: z.string(),
  history: z.array(z.string()),
  answers: z.record(z.string(), z.unknown()),
})

export type ApplicationDraft = z.infer<typeof applicationDraftSchema>
```

- [ ] **Step 2: Parent table `applications`**

`src/shared/db/schema/applications.ts`:
```ts
import type z from 'zod'
import type { ApplicationStatus, ApplicationType } from '@/shared/types/enums'
import type { ApplicationDraft } from '@/shared/entities/applications/schemas'

import { relations, sql } from 'drizzle-orm'
import { check, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'

import { applicationStatuses, applicationTypes } from '@/shared/constants/enums'
import { applicationDraftSchema } from '@/shared/entities/applications/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { meetings } from './meetings'

export type { ApplicationStatus, ApplicationType }

export const applications = pgTable('applications', {
  id,
  type: text('type', { enum: applicationTypes }).notNull(),
  status: text('status', { enum: applicationStatuses }).notNull().default('draft'),
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'cascade' }),

  // In-progress engine-state snapshot: { _v, currentStepId, history, answers }.
  // Sub-project #2's DB StepPersistenceAdapter load/persists THIS. Scratch only —
  // committed answers become the source of truth on submit. Nullable until the
  // engine's first autosave. Zod-validated at the write boundary (not by .$type).
  draftAnswersJSON: jsonb('draft_answers_JSON').$type<ApplicationDraft>(),

  submittedAt: timestamp('submitted_at', { mode: 'string', withTimezone: true }),
  createdAt,
  updatedAt,
}, table => [
  // Any post-draft, non-withdrawn status implies a submission happened.
  // Sub-project #3 tightens this when approved/rejected transitions land.
  check(
    'applications_submitted_at_ck',
    sql`${table.status} IN ('draft', 'withdrawn') OR ${table.submittedAt} IS NOT NULL`,
  ),
])

// Only the FK-target relation is declared here (mirrors proposals.ts, which
// declares owner/financeOption/meeting but NOT its children). The child→parent
// `one()` relations live in the child files. This keeps applications.ts from
// importing its children → no circular import; getApplicationWithAnswers uses
// explicit selects, not relational queries, so the `many` side is unneeded.
export const applicationsRelations = relations(applications, ({ one }) => ({
  meeting: one(meetings, {
    fields: [applications.meetingId],
    references: [meetings.id],
  }),
}))

// draftAnswersJSON is a nullable column with no default → nullable in select,
// and optional+nullable in insert (so `create({ type, meetingId })` is valid).
// The drizzle-zod override replaces the field schema, so re-assert nullability
// explicitly — otherwise a bare `applicationDraftSchema` would make it required.
export const selectApplicationSchema = createSelectSchema(applications, {
  draftAnswersJSON: applicationDraftSchema.nullable(),
})
export type Application = z.infer<typeof selectApplicationSchema>

export const insertApplicationSchema = createInsertSchema(applications, {
  draftAnswersJSON: applicationDraftSchema.nullish(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertApplicationSchema = z.infer<typeof insertApplicationSchema>
```

- [ ] **Step 3: Child table `application_answers`**

`src/shared/db/schema/application-answers.ts`:
```ts
import { relations } from 'drizzle-orm'
import { integer, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'

import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { applications } from './applications'

// Committed answers, exploded from applications.draft_answers_JSON on submit.
// ADR-0005 "dynamic-key map" sub-entity: UNIQUE(application_id, question_key).
// `value` is a stringified scalar; the review panel resolves prompt + type
// from the live step registry (no label snapshot — ruled 2026-07-30). Trades
// do NOT live here — they route to x_application_trades.
export const applicationAnswers = pgTable('application_answers', {
  id,
  applicationId: uuid('application_id')
    .notNull()
    .references(() => applications.id, { onDelete: 'cascade' }),
  questionKey: text('question_key').notNull(),
  value: text('value').notNull(),
  position: integer('position').notNull(),
  createdAt,
  updatedAt,
}, table => [
  unique('application_id_question_key_unique').on(table.applicationId, table.questionKey),
])

export const applicationAnswersRelations = relations(applicationAnswers, ({ one }) => ({
  application: one(applications, {
    fields: [applicationAnswers.applicationId],
    references: [applications.id],
  }),
}))

export type ApplicationAnswer = typeof applicationAnswers.$inferSelect
export type InsertApplicationAnswer = typeof applicationAnswers.$inferInsert
```

- [ ] **Step 4: Junction `x_application_trades`**

`src/shared/db/schema/x-application-trades.ts`:
```ts
import { relations } from 'drizzle-orm'
import { integer, pgTable, unique, uuid } from 'drizzle-orm/pg-core'

import { unsafeId } from '@/shared/db/lib/schema-helpers'
import { applications } from './applications'
import { trades } from './trades'

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

export const applicationTradesRelations = relations(x_applicationTrades, ({ one }) => ({
  application: one(applications, {
    fields: [x_applicationTrades.applicationId],
    references: [applications.id],
  }),
  trade: one(trades, {
    fields: [x_applicationTrades.tradeId],
    references: [trades.id],
  }),
}))

export type X_ApplicationTrade = typeof x_applicationTrades.$inferSelect
export type X_ApplicationTradeInsert = typeof x_applicationTrades.$inferInsert
```

- [ ] **Step 5: Register in the schema barrel**

Append to `src/shared/db/schema/index.ts`:
```ts
// applications
export * from './applications'
export * from './application-answers'
export * from './x-application-trades'
```

- [ ] **Step 6: Type-check, lint, push to dev DB**

Run: `pnpm tsc && pnpm lint`
Expected: clean.
Run: `pnpm db:push:dev`
Expected: the three tables + constraints apply to the dev Neon branch with no destructive warnings (they are all net-new). If drizzle-kit prompts, confirm the additive create.

- [ ] **Step 7: Commit**

```bash
git add src/shared/entities/applications/schemas/index.ts \
  src/shared/db/schema/applications.ts src/shared/db/schema/application-answers.ts \
  src/shared/db/schema/x-application-trades.ts src/shared/db/schema/index.ts
git commit -m "feat(applications): schema — applications + answers child + trades junction

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Visibility + server spec + CRUD DAL

**Files:**
- Create: `src/shared/entities/applications/lib/visibility.ts`
- Create: `src/shared/entities/applications/lib/server-spec.ts`
- Create: `src/shared/entities/applications/dal/server/crud.ts`

**Interfaces:**
- Consumes: `applications` table + `insertApplicationSchema`/`selectApplicationSchema` (Task 2), `APPLICATION` (Task 1), `userParticipatesInMeeting(userId, meetingIdColumn): SQL` from `@/shared/entities/meetings/dal/server/participants`, `EntityServerSpec`/`VisibilityScope` from `@/shared/dal/server/types`, `createCrudDal`.
- Produces: `applicationVisibility({ userId }): SQL`; `applicationServerSpec` (satisfies `EntityServerSpec<typeof applications>`) + `applicationSchemas`; `applicationCrud` (5 CRUD slots).

- [ ] **Step 1: Visibility predicate**

`src/shared/entities/applications/lib/visibility.ts`:
```ts
import type { SQL } from 'drizzle-orm'

import type { VisibilityScope } from '@/shared/dal/server/types'

import { applications } from '@/shared/db/schema'
import { userParticipatesInMeeting } from '@/shared/entities/meetings/dal/server/participants'

/** Agent-visibility predicate. see ../DOCS.md#visibility-via-meeting-participation */
export function applicationVisibility({ userId }: VisibilityScope): SQL {
  return userParticipatesInMeeting(userId, applications.meetingId)
}
```

- [ ] **Step 2: Entity server spec**

`src/shared/entities/applications/lib/server-spec.ts`:
```ts
import type { EntityServerSpec } from '@/shared/dal/server/types'

import {
  applications,
  insertApplicationSchema,
  selectApplicationSchema,
} from '@/shared/db/schema'
import { APPLICATION } from '@/shared/entities/applications/lib/constants'
import { applicationVisibility } from '@/shared/entities/applications/lib/visibility'

// Type/meetingId come from input; status defaults to 'draft' at the column.
// No server-derived fields, so update simply partials the insert schema.
const updateApplicationSchema = insertApplicationSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const applicationSchemas = {
  insert: insertApplicationSchema,
  update: updateApplicationSchema,
}

export const applicationServerSpec = {
  entityName: APPLICATION,
  caslSubject: APPLICATION,
  visibility: applicationVisibility,
  table: applications,
  schemas: {
    insert: insertApplicationSchema,
    update: updateApplicationSchema,
    select: selectApplicationSchema,
  },
} satisfies EntityServerSpec<typeof applications>
```
> No `hooks` and no `duplicate` this phase: `create` is a plain draft insert (`status` defaults at the column), and applications are never duplicated.

- [ ] **Step 3: CRUD DAL**

`src/shared/entities/applications/dal/server/crud.ts`:
```ts
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { applicationServerSpec } from '@/shared/entities/applications/lib/server-spec'

/** Stable CRUD handlers for the applications entity. Single instance, fully typed. */
export const applicationCrud = createCrudDal(applicationServerSpec)
```

- [ ] **Step 4: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean. `applicationServerSpec` satisfies the spec type; `applicationCrud` exposes getById/create/update/delete/duplicate.

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/applications/lib/visibility.ts \
  src/shared/entities/applications/lib/server-spec.ts \
  src/shared/entities/applications/dal/server/crud.ts
git commit -m "feat(applications): visibility + server spec + CRUD DAL

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Business DAL — saveDraft, submitApplication, withdraw

**Files:**
- Create: `src/shared/entities/applications/dal/server/mutations.ts`

**Interfaces:**
- Consumes: `applications`/`applicationAnswers`/`x_applicationTrades` tables, `applicationDraftSchema`/`ApplicationDraft`, `TRADES_QUESTION_KEY`, `db`, `dalDbOperation`, `ThrowableDalError`, `DalReturn`/`ScopedContext`, `Application` type.
- Produces:
  - `saveDraft(ctx, { applicationId: string, state: ApplicationDraft }): Promise<DalReturn<Application>>`
  - `submitApplication(ctx, { applicationId: string }): Promise<DalReturn<Application>>`
  - `withdraw(ctx, { applicationId: string }): Promise<DalReturn<Application>>`

- [ ] **Step 1: Write the mutations**

`src/shared/entities/applications/dal/server/mutations.ts`:
```ts
// Application entity DAL mutations. Business-specific operations beyond CRUD.
// DAL conventions: docs/codebase-conventions/dal-conventions.md

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Application } from '@/shared/db/schema/applications'
import type { ApplicationDraft } from '@/shared/entities/applications/schemas'

import { and, eq, sql } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { applications } from '@/shared/db/schema/applications'
import { applicationAnswers } from '@/shared/db/schema/application-answers'
import { x_applicationTrades } from '@/shared/db/schema/x-application-trades'
import { applicationDraftSchema } from '@/shared/entities/applications/schemas'
import { TRADES_QUESTION_KEY } from '@/shared/entities/applications/lib/constants'

// ── saveDraft ─────────────────────────────────────────────────────────────

/**
 * Autosave target for the engine (sub-project #2's DB adapter). Debounced,
 * idempotent. Only a draft may be autosaved — a submitted/withdrawn
 * application is immutable via this path. see ../../DOCS.md#draft-commit-split
 */
export async function saveDraft(
  ctx: ScopedContext,
  input: { applicationId: string, state: ApplicationDraft },
): Promise<DalReturn<Application>> {
  return dalDbOperation(async () => {
    const [application] = await db
      .select({ id: applications.id, status: applications.status })
      .from(applications)
      .where(and(eq(applications.id, input.applicationId), ctx.scope ?? undefined))
    if (!application) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    if (application.status !== 'draft') {
      throw new ThrowableDalError({ type: 'precondition-failed', reason: 'application_not_draft' })
    }
    const draftAnswersJSON = applicationDraftSchema.parse(input.state)
    const [row] = await db.update(applications)
      .set({ draftAnswersJSON })
      .where(eq(applications.id, input.applicationId))
      .returning()
    if (!row) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    return row
  })
}

// ── submitApplication ───────────────────────────────────────────────────────

/**
 * The draft→commit split. In one transaction: explode draftAnswersJSON.answers
 * into application_answers rows (idempotent upsert) + route the reserved
 * TRADES_QUESTION_KEY value to x_application_trades, then flip status to
 * 'submitted'. draftAnswersJSON is LEFT INTACT (inert record). Only a draft
 * may be submitted. see ../../DOCS.md#draft-commit-split
 */
export async function submitApplication(
  ctx: ScopedContext,
  input: { applicationId: string },
): Promise<DalReturn<Application>> {
  return dalDbOperation(async () => {
    const [application] = await db
      .select({
        id: applications.id,
        status: applications.status,
        draftAnswersJSON: applications.draftAnswersJSON,
      })
      .from(applications)
      .where(and(eq(applications.id, input.applicationId), ctx.scope ?? undefined))
    if (!application) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    if (application.status !== 'draft') {
      throw new ThrowableDalError({ type: 'precondition-failed', reason: 'application_not_draft' })
    }
    if (!application.draftAnswersJSON) {
      throw new ThrowableDalError({ type: 'precondition-failed', reason: 'nothing_to_submit' })
    }

    const { answers } = applicationDraftSchema.parse(application.draftAnswersJSON)

    // Split answers: reserved trades key → junction; everything else → answer rows.
    const answerRows: { applicationId: string, questionKey: string, value: string, position: number }[] = []
    let tradeIds: number[] = []
    let position = 0
    for (const [questionKey, raw] of Object.entries(answers)) {
      if (questionKey === TRADES_QUESTION_KEY) {
        tradeIds = Array.isArray(raw) ? raw.map(Number).filter(n => Number.isInteger(n)) : []
        continue
      }
      answerRows.push({
        applicationId: input.applicationId,
        questionKey,
        value: String(raw ?? ''),
        position: position++,
      })
    }

    const submittedAt = new Date().toISOString()

    const [row] = await db.transaction(async (tx) => {
      if (answerRows.length > 0) {
        await tx.insert(applicationAnswers)
          .values(answerRows)
          .onConflictDoUpdate({
            target: [applicationAnswers.applicationId, applicationAnswers.questionKey],
            set: {
              value: sql`excluded.value`,
              position: sql`excluded.position`,
            },
          })
      }
      if (tradeIds.length > 0) {
        await tx.insert(x_applicationTrades)
          .values(tradeIds.map(tradeId => ({ applicationId: input.applicationId, tradeId })))
          .onConflictDoNothing()
      }
      return tx.update(applications)
        .set({ status: 'submitted', submittedAt })
        .where(eq(applications.id, input.applicationId))
        .returning()
    })
    if (!row) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    return row
  })
}

// ── withdraw ────────────────────────────────────────────────────────────────

/**
 * Pre-decision abandon. A draft or submitted application may be withdrawn.
 * see ../../DOCS.md#lifecycle
 */
export async function withdraw(
  ctx: ScopedContext,
  input: { applicationId: string },
): Promise<DalReturn<Application>> {
  return dalDbOperation(async () => {
    const [application] = await db
      .select({ id: applications.id, status: applications.status })
      .from(applications)
      .where(and(eq(applications.id, input.applicationId), ctx.scope ?? undefined))
    if (!application) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    if (application.status !== 'draft' && application.status !== 'submitted') {
      throw new ThrowableDalError({ type: 'precondition-failed', reason: 'application_not_withdrawable' })
    }
    const [row] = await db.update(applications)
      .set({ status: 'withdrawn' })
      .where(eq(applications.id, input.applicationId))
      .returning()
    if (!row) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    return row
  })
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/applications/dal/server/mutations.ts
git commit -m "feat(applications): DAL mutations — saveDraft, submit (draft→commit), withdraw

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Business DAL — reads (list + getWithAnswers)

**Files:**
- Create: `src/shared/entities/applications/dal/server/queries.ts`

**Interfaces:**
- Consumes: `applications`/`applicationAnswers`/`x_applicationTrades`/`trades` tables, `db`, `dalDbOperation`, `DalReturn`/`ScopedContext`, `Application`/`ApplicationAnswer` types, `applicationStatuses`/`applicationTypes`, `zod`.
- Produces:
  - `applicationListInputSchema` (Zod) + `ApplicationListInput` type.
  - `listApplications(ctx, input): Promise<DalReturn<Application[]>>`
  - `getApplicationWithAnswers(ctx, { applicationId }): Promise<DalReturn<ApplicationWithAnswers>>` (throws `not-found` when absent) where `ApplicationWithAnswers = Application & { answers: ApplicationAnswer[], tradeIds: number[] }`.

- [ ] **Step 1: Write the reads**

`src/shared/entities/applications/dal/server/queries.ts`:
```ts
// Application entity DAL reads. see docs/codebase-conventions/dal-conventions.md

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { ApplicationAnswer } from '@/shared/db/schema/application-answers'
import type { Application } from '@/shared/db/schema/applications'

import { and, asc, eq } from 'drizzle-orm'
import z from 'zod'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { applicationStatuses, applicationTypes } from '@/shared/constants/enums'
import { db } from '@/shared/db'
import { applicationAnswers } from '@/shared/db/schema/application-answers'
import { applications } from '@/shared/db/schema/applications'
import { x_applicationTrades } from '@/shared/db/schema/x-application-trades'

export const applicationListInputSchema = z.object({
  meetingId: z.string().uuid().optional(),
  type: z.enum(applicationTypes).optional(),
  status: z.enum(applicationStatuses).optional(),
}).default({})
export type ApplicationListInput = z.infer<typeof applicationListInputSchema>

export async function listApplications(
  ctx: ScopedContext,
  input: ApplicationListInput,
): Promise<DalReturn<Application[]>> {
  return dalDbOperation(async () => {
    const filters = [
      ctx.scope ?? undefined,
      input.meetingId ? eq(applications.meetingId, input.meetingId) : undefined,
      input.type ? eq(applications.type, input.type) : undefined,
      input.status ? eq(applications.status, input.status) : undefined,
    ]
    return db.select()
      .from(applications)
      .where(and(...filters))
      .orderBy(asc(applications.createdAt))
  })
}

export interface ApplicationWithAnswers extends Application {
  answers: ApplicationAnswer[]
  tradeIds: number[]
}

/** Parent + committed answers + selected trade ids, for the review panel (#3). */
export async function getApplicationWithAnswers(
  ctx: ScopedContext,
  input: { applicationId: string },
): Promise<DalReturn<ApplicationWithAnswers>> {
  return dalDbOperation(async () => {
    const [application] = await db.select()
      .from(applications)
      .where(and(eq(applications.id, input.applicationId), ctx.scope ?? undefined))
    if (!application) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    const answers = await db.select()
      .from(applicationAnswers)
      .where(eq(applicationAnswers.applicationId, input.applicationId))
      .orderBy(asc(applicationAnswers.position))
    const tradeRows = await db.select({ tradeId: x_applicationTrades.tradeId })
      .from(x_applicationTrades)
      .where(eq(x_applicationTrades.applicationId, input.applicationId))
    return { ...application, answers, tradeIds: tradeRows.map(r => r.tradeId) }
  })
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/applications/dal/server/queries.ts
git commit -m "feat(applications): DAL reads — listApplications + getApplicationWithAnswers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: tRPC router + registration

**Files:**
- Create: `src/trpc/routers/applications.router/index.ts`
- Modify: `src/trpc/routers/app.ts`

**Interfaces:**
- Consumes: `applicationServerSpec`/`applicationSchemas` (Task 3), `saveDraft`/`submitApplication`/`withdraw` (Task 4), `listApplications`/`getApplicationWithAnswers`/`applicationListInputSchema` (Task 5), `createEntityRouter`/`createCrudRouter`/`dalToTrpc`/`createTRPCRouter`.
- Produces: `applicationsRouter`, registered in `appRouter`.

- [ ] **Step 1: Write the router**

`src/trpc/routers/applications.router/index.ts`:
```ts
import z from 'zod'

import { applicationSchemas, applicationServerSpec } from '@/shared/entities/applications/lib/server-spec'
import { saveDraft, submitApplication, withdraw } from '@/shared/entities/applications/dal/server/mutations'
import { applicationDraftSchema } from '@/shared/entities/applications/schemas'
import {
  applicationListInputSchema,
  getApplicationWithAnswers,
  listApplications,
} from '@/shared/entities/applications/dal/server/queries'

import { createTRPCRouter } from '../../init'
import { createCrudRouter } from '../../lib/create-crud-router'
import { createEntityRouter } from '../../lib/create-entity-router'
import { dalToTrpc } from '../../lib/dal-to-trpc'

export const applicationsRouter = createEntityRouter(applicationServerSpec, (entity) => {
  return createTRPCRouter({
    // ── CRUD (create = agent starts a draft; status defaults to 'draft') ──
    crud: createCrudRouter({
      spec: applicationServerSpec,
      schemas: { ...applicationSchemas, id: z.string().uuid() },
      authedProcedure: entity.authedProcedure,
      shareableProcedure: entity.shareableProcedure,
    }),

    // ── Business reads ────────────────────────────────────────────────────
    business: createTRPCRouter({
      list: entity.authedProcedure
        .input(applicationListInputSchema)
        .query(async ({ ctx, input }) => {
          return dalToTrpc(await listApplications(ctx, input))
        }),

      getWithAnswers: entity.authedProcedure
        .input(z.object({ applicationId: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
          return dalToTrpc(await getApplicationWithAnswers(ctx, input))
        }),
    }),

    // ── Draft lifecycle (agent + homeowner via the engine) ────────────────
    draft: createTRPCRouter({
      // Autosave target — sub-project #2's DB StepPersistenceAdapter calls this.
      save: entity.authedProcedure
        .input(z.object({
          applicationId: z.string().uuid(),
          state: applicationDraftSchema,
        }))
        .mutation(async ({ ctx, input }) => {
          return dalToTrpc(await saveDraft(ctx, input))
        }),

      submit: entity.authedProcedure
        .input(z.object({ applicationId: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
          return dalToTrpc(await submitApplication(ctx, input))
        }),

      withdraw: entity.authedProcedure
        .input(z.object({ applicationId: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
          return dalToTrpc(await withdraw(ctx, input))
        }),
    }),
  })
})
```
> `entity.authedProcedure` is `agentProcedure` (requires `can('access','Dashboard')`) + scope middleware. The CRUD slots additionally gate the per-slot CASL action (`create`→`create Application`, etc.). Business/draft procedures are agent-gated; add an explicit `ctx.ability.cannot('update','Application')` guard inside `submit`/`withdraw`/`draft.save` ONLY if a reviewer flags it as needed — mirror the proposals `incentives.replace` precedent if so.

- [ ] **Step 2: Register in the app router**

In `src/trpc/routers/app.ts`:
1. Add the import (alphabetical among the router imports):
```ts
import { applicationsRouter } from './applications.router'
```
2. Add `applicationsRouter,` to the `createTRPCRouter({ ... })` object (alphabetical).

- [ ] **Step 3: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: clean. `registerEntity(applicationServerSpec)` fires once at module load (duplicate registration would throw).

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/applications.router/index.ts src/trpc/routers/app.ts
git commit -m "feat(applications): tRPC router (crud + draft lifecycle + reads) + register

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Business-rules doc (DOCS.md)

**Files:**
- Create: `src/shared/entities/applications/DOCS.md`

**Interfaces:** none (documentation). Provides the anchored rule slugs referenced by `// see ../DOCS.md#...` comments written in earlier tasks: `#lifecycle`, `#draft-commit-split`, `#trades-question-key-seam`, `#visibility-via-meeting-participation`.

- [ ] **Step 1: Write DOCS.md**

`src/shared/entities/applications/DOCS.md` — follow the `proposals/DOCS.md` structure (intro; Lifecycle; Rules, each with **Why** / **Reference impl** / **Enforced by**; Anti-patterns; See also; `**Last updated**`). Cover, at minimum, these anchored sections:

```markdown
# Applications — Business Rules

Agent-run, in-home promotion applications (TPR Assistance; Showcase stubbed)
that persist to the DB, link to a meeting, and are reviewed/approved. This
entity is the persistence substrate; the engine/UI is sub-project #2 and the
review/email is #3. Backend module layout mirrors proposals.

## Lifecycle

`draft → submitted → approved | rejected`, plus `withdrawn` (a draft or
submitted application abandoned pre-decision). This phase wires
`draft → submitted` (submit), `draft|submitted → withdrawn` (withdraw), and
draft autosave. `approved`/`rejected` transitions + their decision columns are
sub-project #3.

### draft-commit-split

Draft state lives entirely in `applications.draft_answers_JSON` — the engine
state `{ _v, currentStepId, history, answers }` that #2's DB adapter
load/persists. On **submit**, one transaction explodes `answers` into
`application_answers` rows (`INSERT … ON CONFLICT (application_id, question_key)
DO UPDATE`, idempotent) and routes the reserved trades key to
`x_application_trades`, then flips `status='submitted'` + sets `submitted_at`.
The draft blob is LEFT INTACT as an inert record; committed rows are the source
of truth thereafter. `saveDraft` is gated to `status='draft'`, so a submitted
application's answers are immutable via the draft path.
- **Why:** ADR-0005 — in-progress form state is sparse/whole-fetched (JSONB);
  committed answers are a dynamic-key map that the review panel reads per-row
  (child table, `UNIQUE(application_id, question_key)`); multi-select trades are
  aggregatable, so a junction, never a JSONB array.
- **Reference impl:** `dal/server/mutations.ts` `submitApplication` (modeled on
  proposals' `replaceProposalIncentives`).
- **Enforced by:** `applications_submitted_at_ck` CHECK; the `status='draft'`
  guards in `saveDraft`/`submitApplication`.

### trades-question-key-seam

`TRADES_QUESTION_KEY` (`lib/constants.ts`, value `'trades'`) is the ONE answer
key `submitApplication` special-cases: its value is a `tradeId[]` routed to
`x_application_trades` instead of `application_answers`. Sub-project #2's
multi-select-trades step MUST write its selection under this exact key.
- **Why:** keeps trades joinable/aggregatable and out of the free-text answer
  table; it's the single cross-phase contract between the backend and the engine.
- **Enforced by:** the split loop in `submitApplication`; documented here so #2
  can't drift.

### visibility-via-meeting-participation

Applications have no `ownerId`. Visibility is `userParticipatesInMeeting(userId,
applications.meetingId)` (`lib/visibility.ts`), resolved by `scopeMiddleware`
into `ctx.scope`. Child rows carry no independent visibility — they're written
and read through the scoped parent.
- **Why:** an application belongs to a meeting's participants, mirroring
  proposals' "meeting participation is the gate."
- **Enforced by:** `applicationServerSpec.visibility`; the scope-probe in every
  business DAL fn (`and(eq(applications.id, id), ctx.scope ?? undefined)`).

## Anti-patterns

- ❌ Storing trades as a JSON array in an answer row (breaks aggregation — use
  the junction).
- ❌ Reading/writing child rows without probing the parent under `ctx.scope`.
- ❌ Setting `updated_at` by hand, or using raw SQL `NOW()` for `submitted_at`.
- ❌ Adding decision/discount columns here — those are sub-project #3.

## See also

- Design spec: `docs/superpowers/specs/2026-07-30-applications-data-model-backend-design.md`
- Core-extraction (Phase 1): `docs/superpowers/specs/2026-07-29-multi-step-flow-core-extraction-design.md`
- ADR-0005 (jsonb vs column vs child table); `docs/codebase-conventions/dal-conventions.md`

**Last updated:** 2026-07-30 — initial (sub-project #1: data model + backend).
```
Expand each section to match the depth/quality of `proposals/DOCS.md`. Keep every anchor slug referenced by in-code `// see` comments present.

- [ ] **Step 2: Verify**

Run: `pnpm lint`
Expected: clean (or markdown ignored by the linter — either is fine). No `pnpm tsc` needed (no TS).

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/applications/DOCS.md
git commit -m "docs(applications): entity business-rules DOCS.md

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Backend smoke script + validation run

**Files:**
- Create: `scripts/tmp-smoke-applications-backend.ts`

**Interfaces:**
- Consumes: `SYSTEM_CONTEXT`, `applicationCrud`, `saveDraft`/`submitApplication`/`withdraw`, `getApplicationWithAnswers`, `db`, the schema tables. Uses `import './lib/load-env'` (NOT `dotenv/config`).

- [ ] **Step 1: Write the smoke script**

`scripts/tmp-smoke-applications-backend.ts`:
```ts
import './lib/load-env'

import { and, eq } from 'drizzle-orm'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { applications } from '@/shared/db/schema/applications'
import { meetings } from '@/shared/db/schema/meetings'
import { trades } from '@/shared/db/schema/trades'
import { applicationCrud } from '@/shared/entities/applications/dal/server/crud'
import { TRADES_QUESTION_KEY } from '@/shared/entities/applications/lib/constants'
import { getApplicationWithAnswers } from '@/shared/entities/applications/dal/server/queries'
import { saveDraft, submitApplication, withdraw } from '@/shared/entities/applications/dal/server/mutations'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    throw new Error(`SMOKE FAIL: ${msg}`)
  }
}

async function main() {
  // Need a meeting (dev DB — snapshot from prod if empty) and two trades.
  const [meeting] = await db.select({ id: meetings.id }).from(meetings).limit(1)
  assert(meeting, 'no meetings in dev DB — run `pnpm db:snapshot` first')
  const tradeRows = await db.select({ id: trades.id }).from(trades).limit(2)
  assert(tradeRows.length >= 1, 'no trades in dev DB — run `pnpm db:snapshot` first')
  const tradeIds = tradeRows.map(t => t.id)

  // 1) create a draft
  const created = dalVerifySuccess(
    await applicationCrud.create(SYSTEM_CONTEXT, { type: 'tpr_assistance', meetingId: meeting.id }),
  )
  assert(created.status === 'draft', `expected draft, got ${created.status}`)
  console.log('✓ create →', created.id)

  // 2) autosave a draft engine state
  dalVerifySuccess(await saveDraft(SYSTEM_CONTEXT, {
    applicationId: created.id,
    state: {
      _v: 1,
      currentStepId: 'why-us',
      history: ['tenure', 'trades'],
      answers: { tenure: 12, [TRADES_QUESTION_KEY]: tradeIds, 'why-us': 'Great reputation' },
    },
  }))
  console.log('✓ saveDraft')

  // 3) submit → commit to child rows + junction
  const submitted = dalVerifySuccess(await submitApplication(SYSTEM_CONTEXT, { applicationId: created.id }))
  assert(submitted.status === 'submitted', `expected submitted, got ${submitted.status}`)
  assert(submitted.submittedAt != null, 'submittedAt not set')
  assert(submitted.draftAnswersJSON != null, 'draftAnswersJSON should be kept intact')

  const view = dalVerifySuccess(await getApplicationWithAnswers(SYSTEM_CONTEXT, { applicationId: created.id }))
  assert(view.answers.length === 2, `expected 2 answer rows (tenure, why-us), got ${view.answers.length}`)
  assert(view.tradeIds.length === tradeIds.length, `expected ${tradeIds.length} trade rows, got ${view.tradeIds.length}`)
  assert(!view.answers.some(a => a.questionKey === TRADES_QUESTION_KEY), 'trades leaked into application_answers')
  console.log('✓ submit → answers:', view.answers.map(a => a.questionKey), 'trades:', view.tradeIds)

  // 4) a second draft → withdraw
  const draft2 = dalVerifySuccess(
    await applicationCrud.create(SYSTEM_CONTEXT, { type: 'showcase', meetingId: meeting.id }),
  )
  const withdrawn = dalVerifySuccess(await withdraw(SYSTEM_CONTEXT, { applicationId: draft2.id }))
  assert(withdrawn.status === 'withdrawn', `expected withdrawn, got ${withdrawn.status}`)
  console.log('✓ withdraw')

  // cleanup (cascades to answers + junction)
  await db.delete(applications).where(and(eq(applications.id, created.id)))
  await db.delete(applications).where(and(eq(applications.id, draft2.id)))
  console.log('✓ cleanup — ALL SMOKE CHECKS PASSED')
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [ ] **Step 2: Type-check + lint the script**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 3: Run the smoke against the dev DB**

Run: `pnpm tsx scripts/tmp-smoke-applications-backend.ts`
Expected: prints `✓ create`, `✓ saveDraft`, `✓ submit`, `✓ withdraw`, `✓ cleanup — ALL SMOKE CHECKS PASSED`, exit 0.
- `DRIZZLE_TARGET` stays unset → dev DB. **Never run with `DRIZZLE_TARGET=prod`.**
- If it fails on "no meetings/trades", run `pnpm db:snapshot` and retry.

- [ ] **Step 4: Delete the smoke script (it was a validation artifact)**

The script is never committed — it's created, run, then removed. The `tmp-`
prefix keeps it out of any accidental broad staging.
```bash
rm scripts/tmp-smoke-applications-backend.ts
```

- [ ] **Step 5: Record the pass — no commit**

There is nothing to commit (the script was never tracked). Record in the SDD
ledger that the smoke passed (create → saveDraft → submit committed 2 answer
rows + N trade rows, trades did not leak into `application_answers`, withdraw
flipped status). This task's deliverable is the green smoke run, not a git
commit.
> If you instead choose to KEEP the script as living documentation, `git add`
> it and commit with `chore(applications): backend smoke script` — but the
> spec's default is delete-after-validation.

---

## Self-Review notes (author)

- **Spec coverage:** enums (T1), 3 tables + draft blob (T2), visibility + spec + CRUD (T3), saveDraft/submit/withdraw (T4), list + getWithAnswers (T5), router + registration (T6), DOCS.md rules (T7), smoke validation (T8). Decision columns / review / email / author column / label snapshot all correctly ABSENT (deferred per spec).
- **Type consistency:** `Application` (from `selectApplicationSchema`) is the return type of every mutation; `ApplicationDraft` is the single source (Zod-inferred) used by the column `.$type<>`, `saveDraft`, `submitApplication`, and the router input. `TRADES_QUESTION_KEY` is defined once (T1) and consumed in T4 + T8. `applicationServerSpec` produced in T3 is consumed in T3 (crud) + T6 (router).
- **Import split to watch** (called out because it's the one easy-to-miss thing in this codebase): `dalDbOperation` is imported from `@/shared/dal/server/lib/helpers`, but `ThrowableDalError`/`SYSTEM_CONTEXT`/`dalError` come from `@/shared/dal/server/types`. T4/T5/T8 all show the correct split verbatim.
- **Circular imports avoided:** the parent `applications.ts` declares only its FK-target relation (`meeting`); child→parent `one()` relations live in the child files, so no table imports its children (matches `proposals.ts`).
- **No `pnpm build`** anywhere; every task ends on `tsc + lint` (+ `db:push:dev`/smoke where stateful).
