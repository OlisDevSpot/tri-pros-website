# tRPC Entity Server System — Phase 1a Design

**Issue**: [#193](https://github.com/OlisDevSpot/tri-pros-website/issues/193)
**ADR**: [`docs/adr/0002-entity-server-system.md`](../../adr/0002-entity-server-system.md)
**How-to**: [`docs/how-to/add-an-entity.md`](../../how-to/add-an-entity.md)
**Sibling pattern**: ADR-0001 (Entity Action System, client side)

## Goal

Land the foundational factories (L0/L1/L2 + registry) for the Entity Server System and refactor `domains/permissions/abilities.ts` to derive `EntityName` / `AppSubject` from per-entity constants colocated in `entities/<entity>/lib/constants.ts`.

**Pure additive PR. No entity migrations. No behavior change.** Every existing tRPC procedure runs unchanged. The app loads identically. The factories sit ready for Phase 1b (Proposal migration) to consume.

## Problem

Five frictions in the current tRPC layer warrant the foundation (full motivation in ADR-0002):

1. **30+ inline copies** of `const isOmni = ctx.ability.can('manage', 'all'); const where = isOmni ? undefined : userCanSeeX(...)` — the visibility "dance" repeated across customers, meetings, customer-pipelines routers.
2. **CRUD shapes diverged.** Naming (`getAll` vs `list` vs `getForEdit`; `getProposal` vs `getById`), input schemas, auth checks, visibility wiring — no type-level mechanism keeping them aligned.
3. **Field-level CASL hand-rolled** in customers' `updateProfile`, `updateCustomerContact`, `updateCreatedAt` — three procedures, three near-identical loops over `ability.cannot('update', 'Customer', key)`.
4. **Dual-credential proposal reads inlined ad-hoc.** `getProposal` accepts "authenticated session with CASL OR matching share token" inline, with no shared abstraction for future shareable entities.
5. **Silent visibility-scope leak on `getProposal`.** CASL `can('read', 'Proposal')` is checked but no row-scope predicate is applied. Every agent can read every proposal by direct id.

Phase 1a doesn't fix any of these — Phase 1b+ does. Phase 1a ships the foundation that makes the fix possible without divergent reimplementation.

## Architecture

Three factory layers + one registry. Every CRUD-capable entity flows through this stack.

```
                              ┌──────────────────────────────────────────────┐
L2 — createEntityRouter ───►  │ entity's full tRPC router (CRUD + plugins)   │
                              │ + side-effect: registerEntity(spec)          │
                              └────────────────┬─────────────────────────────┘
                                               │ auto-plugs L1 under `crud`
                              ┌────────────────▼─────────────────────────────┐
L1 — createCrudRouter ─────►  │ tRPC sub-router exposing CRUD slots          │
                              │ • applies CASL action gate per slot          │
                              │ • builds AgentCtx, calls L0                  │
                              │ • maps domain errors → TRPCError             │
                              │ • TS-refuses NestedEntitySpec (generic bound)│
                              │ • reads spec.shareable for dual-credential   │
                              │   getById (baseProcedure + token branch)     │
                              └────────────────┬─────────────────────────────┘
                                               │ pure function calls
                              ┌────────────────▼─────────────────────────────┐
L0 — createCrudHandlers ───►  │ raw async fns: (ctx, input) => result        │
                              │ • framework-agnostic (no TRPCError, no tRPC) │
                              │ • applies visibility scope to reads/writes   │
                              │ • JSONB merge per spec.update.jsonbMerge…    │
                              │ • shareable from RSC, jobs, scripts,         │
                              │   token-auth contexts                        │
                              └──────────────────────────────────────────────┘
```

**Registry**: `entityRegistry: Record<EntityName, EntityServerSpec>` populated by `createEntityRouter` as a load-time side-effect. Phase 1a ships it empty (no entity calls `createEntityRouter` yet). Phase 1b's Proposal migration populates the first entry.

## Type contract

The spec is a discriminated union with `parentEntity` as the discriminant. Both branches share the same shape — `parentEntity: null` only flips required/optional on `caslSubject` and `visibility`.

```ts
// src/trpc/lib/types.ts

import type { AppAbility, AppSubject, EntityName } from '@/shared/domains/permissions/types'
import type { BetterAuthSession } from '@/shared/domains/auth/server'
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import type { z } from 'zod'

export type SlotName = 'list' | 'getById' | 'create' | 'update' | 'delete' | 'duplicate'

/**
 * Framework-agnostic context every L0 handler receives. Session always
 * present — public-token reads (`shareable` entities) take a separate L1
 * branch that bypasses L0 entirely.
 */
export interface AgentCtx {
  session: BetterAuthSession
  ability: AppAbility
  /** Visibility SQL fragment to apply to reads. `null` = omni / no scope. */
  scope: SQL | null
}

// ── Shared base — same shape both branches ────────────────────────────────
interface EntitySpecBase<
  TTable extends PgTable = PgTable,
  TInsert = unknown,
  TUpdate = unknown,
  TSelect = unknown,
> {
  entityName: EntityName
  table: TTable
  schemas: {
    insert: z.ZodType<TInsert>
    update: z.ZodType<TUpdate>
    select: z.ZodType<TSelect>
  }
  /** Defaults to 'id'. Override for serial PKs, custom column names, etc. */
  primaryKey?: string

  // Named typed config — no free-form callbacks. Promote new patterns here
  // only when 2+ entities adopt them.
  shareable?: { tokenColumn: string }
  update?: { jsonbMergeColumns: readonly PgColumn[] }
  list?: {
    searchColumns?: readonly PgColumn[]
    sortableColumns?: Record<string, PgColumn>
    defaultSort?: { column: string, dir: 'asc' | 'desc' }
  }
}

// ── Core branch: parentEntity null → auth REQUIRED ───────────────────────
export interface CoreEntitySpec<...> extends EntitySpecBase<...> {
  parentEntity: null                                    // ← discriminant
  caslSubject: AppSubject                               // REQUIRED
  visibility: (userId: string) => SQL                   // REQUIRED
}

// ── Nested branch: parentEntity non-null → auth OPTIONAL (inherited) ────
//
// DORMANT in Phase 1a. Types compile, but no entity uses this branch yet.
// All new entities MUST be authored as `CoreEntitySpec` until a concrete
// nested-entity consumer emerges and we pressure-test the parent-chain
// resolution rule against a real table.
export interface NestedEntitySpec<...> extends EntitySpecBase<...> {
  parentEntity: EntityName                              // ← discriminant: non-null
  parentRef: { foreignKey: PgColumn }                   // REQUIRED — FK to parent

  caslSubject?: AppSubject                              // OPTIONAL — inherits parent chain
  visibility?: (userId: string) => SQL                  // OPTIONAL — derived from parent
}

export type EntityServerSpec = CoreEntitySpec | NestedEntitySpec

/** CRUD slot signatures. Output types narrow from spec.schemas.select. */
export interface CrudHandlers<Spec extends EntityServerSpec> {
  list:       (ctx: AgentCtx, input: ListInput<Spec>) => Promise<PaginatedResult<Row<Spec>>>
  getById:    (ctx: AgentCtx, input: { id: string }) => Promise<Row<Spec> | undefined>
  create:     (ctx: AgentCtx, input: Insert<Spec>) => Promise<Row<Spec>>
  update:     (ctx: AgentCtx, input: { id: string, data: Update<Spec> }) => Promise<Row<Spec> | undefined>
  delete:     (ctx: AgentCtx, input: { id: string }) => Promise<void>
  duplicate?: (ctx: AgentCtx, input: { id: string }) => Promise<Row<Spec>>
}
```

### The discriminant is the forcing function

`createCrudRouter<TSpec extends CoreEntitySpec>(spec: TSpec, opts?)` — the generic upper bound on `CoreEntitySpec` is what makes TS reject `NestedEntitySpec`. There's no runtime check; the compiler refuses the call.

### Nested inheritance rule (deferred to first real consumer)

For any nested-entity field that can be inherited (`caslSubject`, `visibility`):

```
resolved(field, spec) = spec[field] ?? resolved(field, entityRegistry[spec.parentEntity])
```

Walks the parent chain until a value is found. Core entities terminate the recursion. Override at any level.

For `visibility` specifically, the default derivation when no local override is structural:

```ts
function deriveNestedVisibility(spec: NestedEntitySpec): (userId: string) => SQL {
  return (userId) => {
    const parent = entityRegistry[spec.parentEntity]!
    return exists(
      db.select().from(parent.table).where(and(
        eq(parent.table[parent.primaryKey ?? 'id'], spec.parentRef.foreignKey),
        resolved('visibility', parent)(userId),
      )),
    )
  }
}
```

This logic ships as documentation only in Phase 1a. The L0 implementation throws `Error('NestedEntitySpec not yet implemented — first nested consumer needs to validate the parent-chain resolution rule')` until a real consumer exists.

## L0 / L1 / L2 implementation

### L0 — `createCrudHandlers(spec)`

Returns `CrudHandlers<Spec>` for the spec passed in.

- **Core branch**: fully implemented.
  - `list`: composes `spec.visibility(userId)` (skipped when `ability.can('manage', 'all')`) with the toolkit's `paginatedQueryInput` → `paginate()`. Uses `spec.list.searchColumns / sortableColumns / defaultSort`.
  - `getById`: applies visibility scope, queries by `spec.primaryKey ?? 'id'`.
  - `create`: validates with `spec.schemas.insert`; `db.insert(spec.table).values(data).returning()`.
  - `update`: validates with `spec.schemas.update`; if `spec.update?.jsonbMergeColumns` set, deep-merges those columns instead of replacing; applies visibility scope.
  - `delete`: applies visibility scope; cascade via FK only.
  - `duplicate`: always generated (read-by-id + create-with-same-data is universal). Entities control surface via L1 `exclude: ['duplicate']`. No separate spec field — keeps the spec smaller.
  - Throws domain errors (`new Error('NotFound')`, `new Error('Forbidden')`). Never `TRPCError`.

- **Nested branch**: throws `not yet implemented`. Types compile.

### L1 — `createCrudRouter<TSpec extends CoreEntitySpec>(spec, { exclude? })`

Returns a tRPC router with one procedure per non-excluded slot.

- All slots use `agentProcedure` by default.
- `getById` is special-cased when `spec.shareable` is set:
  - Becomes `baseProcedure` accepting `{ id: string, token?: string }`.
  - **Token path**: if `token` provided and matches `spec.table[spec.shareable.tokenColumn]`, returns the row directly. Visibility bypassed; CASL bypassed.
  - **Session path**: requires session; calls `buildAgentCtx(ctx, spec)` → `L0.getById(agentCtx, { id })`. Applies visibility scope.
- CASL action gate runs *before* the L0 call: `ctx.ability.cannot(<slot-to-action>, spec.caslSubject)` → `TRPCError({ code: 'FORBIDDEN' })`.
- Domain errors from L0 map to TRPCError codes.

Action mapping by slot:

| Slot       | CASL action |
|------------|-------------|
| `list`     | `read`      |
| `getById`  | `read`      |
| `create`   | `create`    |
| `update`   | `update`    |
| `delete`   | `delete`    |
| `duplicate`| `create`    |

### L2 — `createEntityRouter<TSpec extends CoreEntitySpec>(spec, plugins?)`

```ts
createEntityRouter(proposalServerSpec, {
  business: proposalBusinessRouter,
  delivery: proposalDeliveryRouter,
})
// →  { crud: <L1 router>, business: ..., delivery: ... }
```

- Calls `registerEntity(spec)` as a side-effect.
- Auto-mounts `createCrudRouter(spec)` under key `crud`.
- For each `[key, pluginFactory]` in `plugins`, mounts `pluginFactory(spec)` under that key. The factory receives the spec so plugins can use `createCrudHandlers(spec)` to compose with L0.

### `build-agent-ctx.ts` (internal)

```ts
export function buildAgentCtx<Spec extends EntityServerSpec>(
  trpcCtx: { session: BetterAuthSession, ability: AppAbility },
  spec: Spec,
): AgentCtx {
  // For CoreEntitySpec: spec.visibility is required, call it directly.
  // For NestedEntitySpec (dormant): walk parent chain per the inheritance
  // rule defined in "Nested inheritance rule" above. Not exercised in Phase 1a.
  const scope = trpcCtx.ability.can('manage', 'all')
    ? null
    : spec.visibility(trpcCtx.session.user.id)
  return { session: trpcCtx.session, ability: trpcCtx.ability, scope }
}
```

Called by L1 procedure handlers on the session path. Not exported publicly.

### `entity-registry.ts`

```ts
export const entityRegistry: Partial<Record<EntityName, EntityServerSpec>> = {}

export function registerEntity(spec: EntityServerSpec): void {
  if (entityRegistry[spec.entityName]) {
    throw new Error(`Entity ${spec.entityName} already registered`)
  }
  entityRegistry[spec.entityName] = spec
}
```

Phase 1a ships empty. Phase 1b adds Proposal.

## File layout

```
src/trpc/lib/                                          ← NEW directory
├── types.ts                                           # EntityServerSpec union, AgentCtx, SlotName, CrudHandlers
├── entity-registry.ts                                 # entityRegistry + registerEntity()
├── build-agent-ctx.ts                                 # internal helper
├── create-crud-handlers.ts                            # L0
├── create-crud-router.ts                              # L1
└── create-entity-router.ts                            # L2

src/shared/entities/customers/lib/constants.ts         # export const CUSTOMER  = 'Customer'  as const
src/shared/entities/meetings/lib/constants.ts          # export const MEETING   = 'Meeting'   as const
src/shared/entities/proposals/lib/constants.ts         # export const PROPOSAL  = 'Proposal'  as const
src/shared/entities/projects/lib/constants.ts          # export const PROJECT   = 'Project'   as const

src/shared/domains/permissions/abilities.ts            # MODIFY: import constants, derive ENTITY_NAMES
src/shared/domains/permissions/types.ts                # MODIFY: AppSubjects → AppSubject = EntityName | non-entity gates
```

## `abilities.ts` / `types.ts` refactor

The only existing-code modification. Purely additive at the type level — runtime semantics identical.

```ts
// types.ts (after)
import type { MongoAbility } from '@casl/ability'
import type { EntityName } from './abilities'

export type AppAction = 'access' | 'assign' | 'create' | 'delete' | 'manage' | 'read' | 'update'

// AppSubject = entity names + non-entity feature gates + CASL wildcard
export type AppSubject =
  | EntityName               // 'Customer' | 'Meeting' | 'Proposal' | 'Project'
  | 'all'                    // CASL wildcard
  | 'Dashboard'              // route gate
  | 'Calendar'               // feature gate (GCal sync)
  | 'CustomerPipeline'       // feature gate (pipeline-mgmt)
  | 'Activity'               // activity log

export type AppAbility = MongoAbility<[AppAction, AppSubject]>
```

```ts
// abilities.ts (after) — only the imports + ENTITY_NAMES addition; rule bodies unchanged
import { CUSTOMER } from '@/shared/entities/customers/lib/constants'
import { MEETING } from '@/shared/entities/meetings/lib/constants'
import { PROPOSAL } from '@/shared/entities/proposals/lib/constants'
import { PROJECT } from '@/shared/entities/projects/lib/constants'

export const ENTITY_NAMES = [CUSTOMER, MEETING, PROPOSAL, PROJECT] as const
export type EntityName = (typeof ENTITY_NAMES)[number]

// defineAbilitiesFor body unchanged — existing `can('read', 'Customer')` literals
// still typecheck because 'Customer' is a member of EntityName ⊂ AppSubject.
```

### Renames being made

- `AppSubjects` → `AppSubject` (plural → singular; matches ADR-0002)
- `AppActions` → `AppAction` (consistency with `AppSubject`)

Old names removed; no backward-compat alias. Touching ~3-5 import sites that reference these types.

## Phase 1a explicit scope

### What ships

- 6 new files in `src/trpc/lib/`
- 4 entity-name constant files
- `abilities.ts` + `types.ts` type-level refactor
- Spec doc + ADR + how-to (ADR + how-to already on main)

### What does NOT ship

- No existing tRPC procedure is touched.
- No router calls `createEntityRouter` yet — the factory layer sits unconsumed.
- No nested entity exists or migrates.
- Nested L0 implementation throws "not yet implemented." Types compile.
- Visibility predicates stay where they are today (`dal/server/<entity>/visibility.ts`). They migrate to `entities/<entity>/lib/visibility.ts` per ADR-0002 only when their entity migrates.
- Field-level CASL helper (`requireFieldAccess`) deferred to v2 per ADR (one-adopter-not-a-seam).
- Wrap/replace-style CRUD overrides deferred to v2 per ADR.

### Nested branch is dormant — deliberate policy

The discriminated-union types include the Nested branch because (a) the ADR is already written this way, (b) the discriminant *is* the forcing function, (c) real candidate tables exist (`meetingParticipants`, `customerNotes`, `proposalViews`).

**Policy until first nested consumer emerges**: all new entities MUST be `CoreEntitySpec`. The parent-chain resolution rule and `deriveNestedVisibility` join structure are documented but not pressure-tested. When a real nested entity is genuinely needed (not "feels like it could be nested"), revisit the design with the consumer in hand.

This is intentional dormant design. The types exist to preserve architectural framing; the L0 implementation defers until the design can be validated against a real consumer.

## Procedures still "doing too much" — migration scorecard

Phase 1a doesn't fix any of these. This is the running list of where each fat procedure goes once its entity migrates. Each migration phase re-evaluates this table.

| Procedure | LoC | Why bloated | Post-refactor home |
|---|---|---|---|
| `customers.createFromIntake` | ~115 | Creates customer + note + meeting + participant + lead-source lookup in one txn | Out of `customersRouter` → `services/intake.service.ts`. Multi-entity orchestration doesn't belong to one entity. |
| `customers.ensureGeocoded` | ~70 | `.query()` that writes (wrong primitive) | Out → `services/geocoding.service.ts`. Becomes a mutation or RSC-internal side-effect. |
| `customers.updateProfile` | ~25 | 3 JSONB sets, no CASL granularity | Folds into L0/L1 `update` via `spec.update.jsonbMergeColumns`. |
| `customers.updateCreatedAt` + `updateLeadSource` + `updateCustomerContact` | ~75 | Three bespoke updates, each with field-level CASL loops | Single L0/L1 `update`. Field-level CASL is v2 spec field; until then: business plugin procedures wrapping `handlers.update`. |
| `customers.delete` | ~10 + cascade | Cascades to meetings/proposals/notes/projects | L0 `delete`. Cascade strategy externalized to `entities/customers/lib/delete-customer.ts` (one named import L0 calls). |
| `customers.search` | ~30 | Phone-gating heuristic, not standard CRUD | L2 plugin: `customers.search`. |
| `proposals.crud.createProposal` | ~110 (70 inline snapshot) | SOW trade-snapshot inline | L0 `create` is clean; trade snapshot moves to `entities/proposals/lib/snapshot-meeting-trades.ts` and runs from a business plugin `proposals.business.createFromMeeting` that calls `handlers.create`. |
| `proposals.crud.updateProposal` | ~45 | Dual-gate (CASL or token) | L1 `update` is session-only. Token-path becomes explicit business plugin `proposals.business.updateWithToken`. |
| `proposals.crud.getProposal` | ~30 | **Has a visibility leak today** | L1 `getById` with `spec.shareable` resolves both credential paths AND applies visibility on session path. Closes the leak. |
| `proposals.crud.duplicateProposal` | ~30 | Read + create composite | L0 `duplicate`. |
| `proposals.delivery.sendProposalEmail` | ~70 | Email + status update + job dispatch + outcome derive | L2 plugin `proposals.delivery`. Stays a multi-step orchestrator. |
| `proposals.contracts.*` | ~180 total | Zoho Sign integration | L2 plugin `proposals.contracts`. |
| `meetings.linkProposal` | ~20 | Cross-entity (writes 2 tables) | L2 plugin on `proposalsRouter` (it's about associating a proposal). |
| `meetings.duplicate` | ~30 | Cross-entity (GCal push side-effect) | L0 `duplicate` + post-create side-effect via business procedure wrapping `handlers.duplicate`. |
| `meetings.getInternalUsers` | ~15 | Doesn't belong on meetings | Moves to future `users.router`. |
| `meetings.getById` | ~40 | Joins + computed columns (proposalCount, hasSentProposal, gatedPhone) | L0 `getById` is clean; computed columns become a business plugin `meetings.business.getByIdWithStats` until enough entities have computed-column patterns to warrant a named spec field. |
| `meetings.list` (in 859-LoC file) | ~80+ | Massive joined paginated read with pipeline derivation | L0/L1 `list` with `spec.list.searchColumns/sortableColumns/defaultSort`. Pipeline-derived filters via `buildFilterWhere`. |
| `projects.crud.list` | ~50 (overlapping count + scopes parallel fetch) | Custom paginate variant | L0/L1 `list`; project-scopes batch fetch becomes a separate procedure or a `list` post-hook (v2 spec field). |

**Cross-cutting rule** (from ADR-0002 consequences): the factory's output is sufficient for ~70% of procedures. The remaining ~30% become L2 plugin procedures that explicitly call `handlers.<slot>` internally — never hand-written CRUD that bypasses the factory.

## Validation gates

The PR must pass:

- `pnpm tsc` clean — new factory types compile; `EntityName` derives correctly; `AppSubject` derives correctly
- `pnpm lint` clean
- App loads; agent dashboard renders; existing customer/meeting/proposal/project screens render unchanged
- No tRPC procedure call site touched (the diff for `app.ts` and every `*.router.ts` is empty)
- `EntityServerSpec` discriminated union enforces correct fields per branch (manually verified: write a wrong spec in scratch file, confirm TS errors, delete scratch file)
- `createCrudRouter` refuses to compile when passed a `NestedEntitySpec` (manually verified same way)
- Existing CASL rules unchanged in semantics — `defineAbilitiesFor` returns the same `AppAbility` for the same inputs as before

## Open design decisions captured

These were considered and decided during brainstorming. Listed for future readers and for the implementation plan.

1. **Spec entity-name constants live at `entities/<entity>/lib/constants.ts`**, not `entities/<entity>/constants/entity.ts`. The how-to specifies this, and `lib/` is where "identity facts other modules import to derive types" already lives. The existing `constants/` directories hold UI/action constants; we don't re-export entity identity through them.

2. **`AppSubjects` → `AppSubject` rename** (plural → singular). Matches ADR-0002 vocabulary. Old name removed without alias. Touches ~3-5 import sites.

3. **Phase 1a delivers fully working Core L0**, not type stubs. Phase 1b's Proposal migration is a real consumer; the factory has to function for it to migrate. Nested L0 is the only deferred implementation.

4. **Nested L0 deferred until first concrete consumer.** Types compile; runtime throws. Documented as intentional dormancy.

5. **Field-level CASL deferred to v2.** Customer's per-field loop is the only current adopter — one-adopter-not-a-seam per ADR.

6. **Wrap/replace CRUD overrides deferred to v2.** Inline business rules go in L2 plugin procedure bodies calling `handlers.<slot>` directly. Promote to factory args only when pattern repeats across entities.

7. **Existing CASL call sites with string literals stay.** `can('read', 'Customer')` still typechecks because `'Customer'` is a member of `EntityName ⊂ AppSubject`. Mass-replace to `can('read', CUSTOMER)` lives in Phase 1b+ as it migrates each entity.

## Next steps after this PR

- **Phase 1b** ([#194](https://github.com/OlisDevSpot/tri-pros-website/issues/194)): Proposal migration. Pre-step: split `proposals.router.ts` already done (it's `proposals.router/{crud,delivery,contracts}.router.ts`). Author `proposalServerSpec` + visibility predicate + business plugin; replace `crudRouter` with `createCrudRouter(proposalServerSpec)`. Fixes the visibility-scope leak.
- **Phase 2**: Customer migration. Pre-step: split `customers.router.ts` (513 LoC flat file) into `customers.router/{crud,business}.router.ts`.
- **Phase 3**: Meeting migration. Pre-step: split `meetings.router.ts` (859 LoC flat file) into `meetings.router/{crud,business,participants}.router.ts`.
- **Phase 4**: Project migration. Smallest delta — already split.

Each migration is a single PR. Each pressure-tests a different design surface before the next.
