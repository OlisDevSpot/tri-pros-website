# Entity Lifecycle Hooks Redesign

> Date: 2026-05-19 | Follows: `entity-hooks-session-handoff.md`
> Scope: Unified hooks on `EntityServerSpec`, DAL-level execution, migration of meetings + proposals + customers

## Problem

The entity server system has two separate hook systems:

1. **DAL-level sync hooks** (`spec.hooks.beforeCreate`, `beforeUpdate`, `beforeDuplicate`) — data enrichment, no async, invoked by `createCrudDal`
2. **Router-level lifecycle callbacks** (`createCrudRouter.lifecycle.onCreated`, `onUpdated`, `onDeleted`, `onDuplicated`) — async side effects, invoked by `createCrudRouter`

This creates confusion:
- Developers must know which layer to use for what
- Entity business logic ends up in `trpc/routers/` (wrong location — see `meetings.router/lifecycle.ts`)
- The split creates artificial questions: "is pipeline derivation a DAL concern or router concern?"
- Only meetings uses both systems. Proposals uses handler overrides instead. Customers uses neither.

## Decision

Collapse both systems into a single **lifecycle hooks** object on `EntityServerSpec`. All hooks — both before and after — execute at the DAL layer inside `createCrudDal`.

### Framework Precedent

Every major framework that implements hooks keeps before and after at the same layer:

- **better-auth** — `databaseHooks` with `entity.operation.before/after`, both at the database layer
- **Payload CMS** — `beforeChange`/`afterChange` on collection config, both inside the operation boundary (after hooks can participate in the request transaction)
- **Prisma Client Extensions** — wraps the entire operation; before and after are two halves of the same function
- **Drizzle ORM** — no hooks (thin query builder) — we build our own

No framework splits before/after across different architectural layers. Hooks describe entity lifecycle, not architectural layers.

## Design

### EntityServerSpec Type

```ts
export interface EntityServerSpec<
  TTable extends PgTable = PgTable,
  TId extends string | number = string,
> {
  entityName: EntityName
  caslSubject: AppSubject
  visibility: (userId: string) => SQL
  table: TTable
  schemas: {
    insert: z.ZodObject<Record<string, z.ZodTypeAny>>
    update: z.ZodObject<Record<string, z.ZodTypeAny>>
    select: z.ZodObject<Record<string, z.ZodTypeAny>>
  }
  primaryKey?: string
  shareable?: { tokenColumn: string }
  update?: { jsonbMergeColumns: readonly PgColumn[] }

  /**
   * Entity lifecycle hooks. Executed by createCrudDal — both before and after.
   *
   * - `before` hooks: async, data transformation. Can read DB via DAL functions.
   *   Receives ScopedContext. Return the (possibly enriched) data.
   * - `after` hooks: async, side effects (services, notifications, realtime).
   *   Receives ScopedContext + the written row. The hook implementation decides
   *   what to `await` (critical) vs `void .catch()` (best-effort).
   *
   * Hooks should be thin orchestrators — pure business logic belongs in
   * `entities/<entity>/lib/`, service orchestration uses existing services.
   */
  hooks?: {
    create?: {
      before?(input: Insert<TTable>, ctx: ScopedContext): Promise<Insert<TTable>> | Insert<TTable>
      after?(row: Row<TTable>, ctx: ScopedContext): Promise<void>
    }
    update?: {
      before?(data: Update<TTable>, ctx: ScopedContext): Promise<Update<TTable>> | Update<TTable>
      after?(row: Row<TTable>, ctx: ScopedContext, meta: {
        previousRow: Row<TTable>
        input: Update<TTable>
      }): Promise<void>
    }
    delete?: {
      before?(id: string | number, ctx: ScopedContext): Promise<void>
      after?(id: string | number, ctx: ScopedContext): Promise<void>
    }
  }

  /**
   * Declarative duplicate config. Default behavior: copy full row minus PK.
   * Duplicate routes through createImpl — create hooks fire automatically.
   * This is NOT a hook. It's declarative configuration for field selection.
   */
  duplicate?: {
    /** Fields to drop beyond PK (which is always dropped). */
    exclude?: readonly string[]
    /** Override/transform specific field values on the copy. */
    overrides?(source: Row<TTable>, ctx: ScopedContext): Partial<Insert<TTable>>
  }
}
```

All method signatures use bivariant method syntax (existing lint escape for `ts/method-signature-style` — required for `EntityServerSpec<Table>` → `EntityServerSpec<PgTable>` assignability).

### Hook Contract

| Property | `before` hooks | `after` hooks |
|---|---|---|
| **Async** | Yes (`Promise<T> \| T`) | Yes (`Promise<void>`) |
| **Purpose** | Data transformation, enrichment | Side effects (services, notifications, realtime) |
| **DB access** | Via DAL functions, never naked `db` | Via DAL functions, never naked `db` |
| **Context** | `ScopedContext` (session may be null for jobs/services) | `ScopedContext` |
| **Return** | Enriched input data | void |
| **Error handling** | Throw to abort the operation | Hook impl decides: `await` for critical, `void .catch()` for best-effort |
| **Invoked by** | `createCrudDal` — before the DB write | `createCrudDal` — after the DB write |

### createCrudDal Changes

All five CRUD functions in `create-crud-dal.ts` change to invoke hooks from the spec.

**createImpl:**
1. Call `spec.hooks?.create?.before(input, ctx)` — await result
2. Validate with `spec.schemas.insert.parse(enriched)`
3. INSERT + returning
4. Call `spec.hooks?.create?.after(row, ctx)` — await result

**updateImpl:**
1. Call `spec.hooks?.update?.before(data, ctx)` — await result
2. If `spec.hooks?.update?.after` defined, fetch `previousRow` via `getByIdImpl` (one extra SELECT, only when needed)
3. Validate with `spec.schemas.update.parse(enriched)`
4. UPDATE + returning
5. Call `spec.hooks?.update?.after(row, ctx, { previousRow, input })` — await result

**deleteImpl:**
1. Call `spec.hooks?.delete?.before(id, ctx)` — await (gate/validation)
2. DELETE + returning
3. Call `spec.hooks?.delete?.after(id, ctx)` — await result

**duplicateImpl:**
1. Fetch source row via `getByIdImpl`
2. Copy full row, drop PK + `spec.duplicate?.exclude` fields
3. Apply `spec.duplicate?.overrides?.(source, ctx)` on top
4. Pass result to `createImpl` — create hooks fire automatically

### createCrudRouter Changes

- Remove `lifecycle` config from `CreateCrudRouterConfig` entirely
- Router becomes: CASL gate + Zod validation + `dalToTrpc` bridge (no hook awareness)
- Keep `handlers` override escape hatch with explicit warning:

```ts
/**
 * Override individual CRUD handlers. Merged with createCrudDal defaults.
 * ⚠️ Overrides BYPASS spec.hooks entirely — the override replaces the
 * full DAL function including its before/after hook invocations.
 * Prefer spec.hooks for data enrichment; use this only when the entire
 * operation must be replaced.
 */
handlers?: Partial<CrudHandlers<TTable, TId>>
```

## Entity Migrations

### Meetings

**Before (two systems):**
- `spec.hooks.beforeCreate` → stamps ownerId
- `spec.hooks.beforeUpdate` → derives pipeline from outcome
- `spec.hooks.beforeDuplicate` → cherry-picks fields
- `lifecycle.ts` (in `trpc/routers/meetings.router/`) → participant + GCal + notification + Ably

**After (unified):**
- `spec.hooks.create.before` → stamps ownerId
- `spec.hooks.create.after` → participant + GCal (merged from lifecycle `onCreated` + `onDuplicated`)
- `spec.hooks.update.before` → derives pipeline from outcome
- `spec.hooks.update.after` → GCal + notification + Ably (merged from lifecycle `onUpdated`)
- `spec.duplicate` → declarative exclude + overrides (replaces `beforeDuplicate`)

**Implementation note:** The `duplicate.exclude` list must be verified against the actual meetings schema columns. The current `beforeDuplicate` cherry-picks `ownerId`, `customerId`, `meetingType`, `scheduledFor`, `contextJSON` — everything else is implicitly excluded. The declarative config inverts this: list what to exclude, keep everything else. Verify the full column set during implementation.

**Files deleted:** `src/trpc/routers/meetings.router/lifecycle.ts`
**Files modified:** `meetings/lib/server-spec.ts`, `meetings.router/index.ts`

### Proposals

**Before (custom handler overrides):**
- `proposalCreateDal` — 95-line function: reads meeting, derives kind, generates token, snapshots SOW, inserts
- `proposalDuplicateDal` — cherry-picks fields, delegates to `proposalCreateDal` for re-derivation

**After (hooks + declarative duplicate):**
- `spec.hooks.create.before` → reads meeting via DAL, derives kind, generates token, snapshots SOW
- `spec.duplicate` → declarative exclude + overrides (label prefix, status reset, owner reassignment)
- `handlers` override removed from proposals router

**Files deleted:** `proposalCreateDal` and `proposalDuplicateDal` from `proposals/dal/server/mutations.ts` (keep `recordProposalView` — it's unrelated)
**Files created:**
- `proposals/lib/snap-sow-from-meeting.ts` — SOW snapshot logic extracted
- `proposals/lib/generate-share-token.ts` — token generation extracted

**Files modified:** `proposals/lib/server-spec.ts`, `proposals.router/index.ts`

**Implementation note:** The `duplicate.exclude` list must be verified against the actual proposals schema columns. The current `proposalDuplicateDal` cherry-picks `label`, `ownerId`, `status`, `formMetaJSON`, `projectJSON`, `fundingJSON`, `financeOptionId`, `meetingId` — everything else is implicitly excluded. Verify the full column set during implementation.

**Convention fix:** Current `proposalCreateDal` uses naked `db.select()` on `meetings` table. The hook replacement reads via `meetingCrud.getById(SYSTEM_CONTEXT, ...)` — DAL-first, no naked DB access.

### Customers

No hooks, no duplicate config. Spec unchanged.

## Helper Extraction Pattern

Hooks should be thin orchestrators. Business logic belongs in `entities/<entity>/lib/` as pure, testable functions. Services handle cross-entity orchestration.

```
hooks call → lib/ helpers (pure logic)
           → services (orchestration)
           → DAL functions (data access)

hooks never contain → inline business logic
                    → naked db calls
                    → duplicated patterns
```

**Proposals extractions:**

| Helper | Source | Purpose |
|---|---|---|
| `derive-proposal-kind.ts` | Already exists | Derive kind from meeting's projectId |
| `create-empty-sow-section.ts` | Already exists | Build SOW section from trade selections |
| `snap-sow-from-meeting.ts` | Extract from `proposalCreateDal` | Snapshot SOW from meeting flow state into proposal projectJSON |
| `generate-share-token.ts` | Extract from `proposalCreateDal` | Generate `tpr-` prefixed share token |

**Meetings:** No new extractions needed — `OUTCOME_PIPELINE_MAP` already exists for pipeline derivation. Side effects already use extracted services (`schedulingService`, `notificationService`, `ably`).

## Documentation Updates

After implementation, update these docs to codify the hooks contract:

### `src/trpc/DOCS.md`
Add a "Lifecycle Hooks" section covering the full hook contract (async, ScopedContext, DAL-level execution, thin orchestrator rule, handler override escape hatch).

### `docs/adr/0002-entity-server-system.md`
Update hooks section: remove references to two-layer system, document unified model with framework precedent, record decision rationale.

### `docs/how-to/add-an-entity.md`
Update hooks step: show lifecycle hooks pattern with concrete example, show declarative duplicate config, emphasize helper extraction.

### `docs/codebase-conventions/dal-conventions.md`
Add: DAL is the hook execution engine. Hooks can call other DAL functions. Never naked `db` in hooks. `before` return type `Promise<T> | T`. `after` return type `Promise<void>`.

### Per-entity DOCS.md
- `meetings/DOCS.md` — reference new hook locations, remove `lifecycle.ts` references
- `proposals/DOCS.md` — reference new hook locations, remove `proposalCreateDal`/`proposalDuplicateDal` references

## Out of Scope

- Customer entity CRUD router migration — separate issue
- Project entity migration — separate issue (#213)
- `delete.before` as a soft-delete mechanism — future design if needed
- Hook composition (stacking multiple hooks per operation) — YAGNI for 4 entities
- Transaction boundaries for after hooks — current fire-and-forget pattern is sufficient
