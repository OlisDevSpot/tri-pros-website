# CRUD DAL Sub-plan A — Factory config-factory + hook relocation & update/delete hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invert entity lifecycle hooks off `EntityServerSpec` onto the `createCrudDal` invocation via a config factory, establish the two-layer (factory-invariant + call-site) hook execution model, and harden the update/delete impls (G7 empty-update, G4 delete-row) — proven end-to-end on the meetings entity, and close the hookless-rebuild back door by making `createCrudRouter`'s `crud` instance required.

**Architecture:** `createCrudDal(spec, configFactory?)` builds its handlers first, then hands them (late-bound) to an optional `configFactory` that returns the entity's hooks + duplicate config — killing the circular barrier that made hooks reach for raw `db`. A uniform internal `cfg` is either the factory's return or a throwaway `synthesizeFromSpec` adapter over the still-present-but-`@deprecated` `spec.hooks`, so unmigrated entities behave identically. `createCrudRouter` requires the entity's single `crud` instance (no internal rebuild). Only meetings relocates its hooks in A; type purification and the other three relocations are Sub-plan D.

**Tech Stack:** TypeScript, Drizzle ORM 0.45.1 (Postgres/Neon), Zod, tRPC. Path alias `@/` → `src/`. Package manager pnpm.

**Spec:** `docs/superpowers/specs/2026-08-13-crud-dal-sub-plan-a-factory-config-hooks-design.md` (read it alongside this plan — the plan argues from it).

## Global Constraints

- **No test runner exists** (0 test files, no vitest/jest). Verification is `pnpm tsc` (`tsc --noEmit`) + `pnpm lint` (`next lint`). **NEVER `pnpm build`.** Do not scaffold a test framework. Type-contract steps verify red→green via `pnpm tsc`; the two runtime behaviors `tsc` cannot catch (G7 empty-update write, G4 delete prefetch) verify via a temporary `pnpm tsx scripts/tmp-*.ts` script against the **dev** DB, deleted before the final commit.
- **Dev DB only.** Scripts hit the dev DB when run **without** `DRIZZLE_TARGET`. Never set `DRIZZLE_TARGET=prod`. Temporary scripts start with `import './lib/load-env'` (NOT `dotenv/config`) and live at `scripts/tmp-*.ts`.
- **Work on `main`.** Stage explicitly by path (`git add <path>`), never `git add -A`. Commit only the files each task names.
- **DRY / reuse over create (enforced conventions).** Hook signatures are defined **once** (a per-slot lookup map) and every hook type derives from it — no hand-mirrored copies (`memory/feedback-typing-priority.md`, `feedback-reuse-existing-api-surface.md`). `CrudMutationSlot` derives from the map, not a parallel literal set.
- **No defensive / backwards-compat dead weight.** Transitional code is either removed now or `@deprecated` with an explicit removal pointer. This plan makes `createCrudRouter.crud` **required** immediately (not an optional fallback), and tags the one unavoidable transitional shim (`synthesizeFromSpec`) `@deprecated`.
- **`ctx.tx` / transactions are Sub-plan B.** A does **not** add a `ctx.tx ?? db` seam — impls call `db` directly, exactly as today. B introduces `ScopedContext.tx` and the `exec` seam together, so A carries no cast asserting a field that does not yet exist.
- **`afterCommit` is Sub-plan C.** The `afterCommit?` field exists on the call-site hook type (stable option surface) but is NEVER invoked in A.
- **No manual `updatedAt` in `.set()`** (`memory/feedback-no-manual-updated-at.md`) — trivially honored: G7 never writes `updatedAt` at all (empty update = no-op); real updates use `.set(validated)` and let Drizzle's registered `$onUpdate` append it, exactly as today.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/shared/dal/server/types.ts` | Type surface: `MaybePromise`, meta types, the `CrudSlotHookMap` lookup + derived `CrudHooks`/`CrudCallsiteHooks`, `CrudConfig`, `CrudConfigFactory`; widen `CrudHandlers` slots; `@deprecated` `EntityServerSpec.hooks`/`duplicate` | 1 |
| `src/shared/dal/server/lib/create-crud-dal.ts` | The engine: config-factory wiring, late-bound bootstrap, `@deprecated synthesizeFromSpec` adapter, two-layer hook execution, G7 empty-update no-op, G4 delete-row | 2 |
| `src/trpc/lib/create-crud-router.ts` | Require the entity's `crud` instance; delete the internal `createCrudDal` rebuild | 3 |
| `src/trpc/routers/{applications,customers,proposals,customer-notes,meetings}.router/*` | Pass each entity's existing `*Crud` into `createCrudRouter` | 3 |
| `src/shared/entities/meetings/lib/server-spec.ts` | Shrinks to pure identity (hooks + duplicate removed) | 4 |
| `src/shared/entities/meetings/dal/server/crud.ts` | Home of meetings' config factory (hooks + duplicate) | 4 |
| `scripts/tmp-verify-crud-a.ts` | Throwaway G7/G4 runtime verification (deleted in Task 4) | 2, 4 |

---

## Task 1: Type surface in `types.ts` (single-sourced hooks + `@deprecated`)

Additive types + one lookup map + JSDoc. No behavior change; existing `createCrudDal` still reads `spec.hooks`; existing 2-arg handlers still satisfy the widened `CrudHandlers` slots. `pnpm tsc` stays green throughout.

**Files:**
- Modify: `src/shared/dal/server/types.ts`

**Interfaces:**
- Consumes: existing `Insert`, `Row`, `Update`, `ScopedContext`, `EntityServerSpec`, `CrudHandlers`, `DalReturn`, `SlotName` (all already in this file / `@/shared/db/types`).
- Produces (later tasks rely on these EXACT names):
  - `type MaybePromise<T> = T | Promise<T>`
  - `interface CreateAfterMeta<TTable extends PgTable> { input: Insert<TTable> }`
  - `interface UpdateAfterMeta<TTable extends PgTable> { previousRow: Row<TTable>, input: Update<TTable> }`
  - `interface CrudSlotHookMap<TTable extends PgTable, TId extends string | number>` — the ONE source of truth for per-slot before/after signatures
  - `type CrudMutationSlot = keyof CrudSlotHookMap<PgTable, string>` (= `'create' | 'update' | 'delete'`)
  - `type CrudHooks<TTable, TId>` — factory-invariant hooks (each slot optional)
  - `type CrudCallsiteHooks<TTable, TId, S extends CrudMutationSlot>` — a slot's hooks + `afterCommit`
  - `interface CrudConfig<TTable, TId>` — `{ hooks?: CrudHooks, duplicate? }`
  - `type CrudConfigFactory<TTable, TId> = (crudHandlers: CrudHandlers<TTable, TId>) => CrudConfig<TTable, TId>`
  - `CrudHandlers` mutating slots gain an optional trailing `options` arg typed via `CrudCallsiteHooks`.

- [ ] **Step 1: Capture the green baseline**

Run: `pnpm tsc`
Expected: PASS (0 errors). Task 1 must not introduce any.

- [ ] **Step 2: Add `MaybePromise` + meta types**

In `src/shared/dal/server/types.ts`, after the `VisibilityScope` block (before `EntityServerSpec`), add:

```ts
// ── Hook plumbing (Sub-plan A) ──────────────────────────────────────────

/** A hook may be sync or async. No existing repo util covers this. */
export type MaybePromise<T> = T | Promise<T>

/** Meta for a create `after` hook. `input` is the ORIGINAL insert payload. */
export interface CreateAfterMeta<TTable extends PgTable> {
  input: Insert<TTable>
}

/** Meta for an update `after` hook. `previousRow` is the pre-update snapshot; `input` is the ORIGINAL update payload. */
export interface UpdateAfterMeta<TTable extends PgTable> {
  previousRow: Row<TTable>
  input: Update<TTable>
}
```

- [ ] **Step 3: Add the single-source hook lookup map + derived hook types**

Below the meta types. This is the ONLY place per-slot hook signatures are written; everything else indexes into it. `after` returns `Row | void` in A (deprecated void hooks stay assignable; the engine coalesces `?? row`; D tightens to strict `Row`). `delete` hooks take the **row** (G4):

```ts
/**
 * SINGLE source of truth for per-slot hook signatures. Add a slot or change a
 * signature here and every hook type below follows. `create`/`update` `before`
 * threads (transforms) the payload; `delete` `before`/`after` take the pre-delete
 * row and return void.
 */
export interface CrudSlotHookMap<TTable extends PgTable, TId extends string | number> {
  create: {
    before?: (input: Insert<TTable>, ctx: ScopedContext) => MaybePromise<Insert<TTable>>
    after?: (row: Row<TTable>, ctx: ScopedContext, meta: CreateAfterMeta<TTable>) => MaybePromise<Row<TTable> | void>
  }
  update: {
    before?: (data: Update<TTable>, ctx: ScopedContext, meta: { id: TId }) => MaybePromise<Update<TTable>>
    after?: (row: Row<TTable>, ctx: ScopedContext, meta: UpdateAfterMeta<TTable>) => MaybePromise<Row<TTable> | void>
  }
  delete: {
    before?: (row: Row<TTable>, ctx: ScopedContext) => MaybePromise<void>
    after?: (row: Row<TTable>, ctx: ScopedContext) => MaybePromise<void>
  }
}

/** The three hook-bearing mutation slots, derived from the map (stays in sync). */
export type CrudMutationSlot = keyof CrudSlotHookMap<PgTable, string>

/** Factory-invariant hooks — each slot optional. Fire every call, every origin. */
export type CrudHooks<TTable extends PgTable, TId extends string | number = string> = {
  [S in CrudMutationSlot]?: CrudSlotHookMap<TTable, TId>[S]
}

/**
 * Call-site hooks for ONE slot: that slot's before/after (looked up) PLUS a
 * commit-boundary hook. `afterCommit` is declared for a stable option surface
 * but WIRED by Sub-plan C — never invoked in A.
 */
export type CrudCallsiteHooks<
  TTable extends PgTable,
  TId extends string | number,
  S extends CrudMutationSlot,
> = CrudSlotHookMap<TTable, TId>[S] & {
  afterCommit?: (row: Row<TTable>, ctx: ScopedContext) => void
}
```

- [ ] **Step 4: Add `CrudConfig` + `CrudConfigFactory` (compose, don't redeclare)**

Below the hook types. `hooks` reuses `CrudHooks` — the signatures are NOT rewritten here:

```ts
/**
 * Factory-invariant hook + duplicate config for an entity. Returned by a
 * `CrudConfigFactory`, or synthesized from `EntityServerSpec` (deprecated path)
 * by `synthesizeFromSpec` in create-crud-dal.ts.
 */
export interface CrudConfig<TTable extends PgTable, TId extends string | number = string> {
  hooks?: CrudHooks<TTable, TId>
  duplicate?: {
    exclude?: readonly string[]
    overrides?: (source: Row<TTable>, ctx: ScopedContext) => Partial<Insert<TTable>>
  }
}

/**
 * Late-bound config factory. Receives the crud handlers the factory itself
 * produces, so a hook can call `crudHandlers.getById(...)` for a same-entity
 * read — resolved at call time, long after construction. This kills the
 * circular barrier (spec §1.1, §2.3).
 */
export type CrudConfigFactory<TTable extends PgTable, TId extends string | number = string>
  = (crudHandlers: CrudHandlers<TTable, TId>) => CrudConfig<TTable, TId>
```

- [ ] **Step 5: Widen `CrudHandlers` mutating slots with the optional `options` arg**

Replace the `CrudHandlers` body (getById unchanged). Options type is the per-slot `CrudCallsiteHooks` lookup — duplicate routes through create so it reuses `'create'`:

```ts
export interface CrudHandlers<TTable extends PgTable, TId extends string | number = string> {
  getById: (ctx: ScopedContext, input: { id: TId }) => Promise<DalReturn<Row<TTable> | undefined>>
  create: (ctx: ScopedContext, input: Insert<TTable>, options?: CrudCallsiteHooks<TTable, TId, 'create'>) => Promise<DalReturn<Row<TTable>>>
  update: (ctx: ScopedContext, input: { id: TId, data: Update<TTable> }, options?: CrudCallsiteHooks<TTable, TId, 'update'>) => Promise<DalReturn<Row<TTable>>>
  delete: (ctx: ScopedContext, input: { id: TId }, options?: CrudCallsiteHooks<TTable, TId, 'delete'>) => Promise<DalReturn<void>>
  duplicate: (ctx: ScopedContext, input: { id: TId }, options?: CrudCallsiteHooks<TTable, TId, 'create'>) => Promise<DalReturn<Row<TTable>>>
}
```

- [ ] **Step 6: Mark `EntityServerSpec.hooks` and `.duplicate` `@deprecated`**

Do NOT change their signatures. Prepend an `@deprecated` line to each existing JSDoc so editors/reviewers see the scheduled removal. On `hooks?`:

```ts
  /**
   * @deprecated Sub-plan A relocates hooks onto `createCrudDal(spec, configFactory)`.
   * Still read via `synthesizeFromSpec` for entities not yet migrated; REMOVED in
   * Sub-plan D — see docs/superpowers/plans/2026-08-16-crud-dal-sub-plan-a-factory-config-hooks.md.
   *
   * Entity lifecycle hooks. ... (keep the rest of the existing comment unchanged) ...
   */
  hooks?: { /* unchanged */ }
```

And on `duplicate?`, the same `@deprecated` preamble ("relocated into the config factory; removed in Sub-plan D").

- [ ] **Step 7: Verify green**

Run: `pnpm tsc`
Expected: PASS (0 errors) — additive types + JSDoc only.

- [ ] **Step 8: Commit**

```bash
git add src/shared/dal/server/types.ts
git commit -m "feat(dal): single-sourced CrudConfig/config-factory type surface (crud-dal sub-plan A)"
```

---

## Task 2: The engine — `create-crud-dal.ts`

Rewrite the factory to accept `configFactory`, build handlers late-bound, read a uniform `cfg`, run the two-layer onion, and harden update (G7) + delete (G4). Impls call `db` directly (no `ctx.tx` seam — that's B). Existing entities pass **no** `configFactory`, so `synthesizeFromSpec` reproduces today's behavior. One atomic task (the impls share `cfg`/hook-execution structure).

**Files:**
- Modify: `src/shared/dal/server/lib/create-crud-dal.ts` (full rewrite of factory + impls)
- Create (temporary): `scripts/tmp-verify-crud-a.ts`

**Interfaces:**
- Consumes: `CrudConfig`, `CrudConfigFactory`, `CrudCallsiteHooks`, `CreateAfterMeta`, `UpdateAfterMeta`, `CrudHandlers`, `EntityServerSpec`, `ScopedContext`, `DalReturn`, `ThrowableDalError` (`../types`); `Insert`, `Row`, `Update` (`@/shared/db/types`); `db` (`@/shared/db`); `and`, `eq` (`drizzle-orm` — already imported); `dalDbOperation` (`./helpers`).
- Produces: `createCrudDal<TTable, TId>(spec, configFactory?): CrudHandlers<TTable, TId>` — same return type, optional 2nd arg; mutating handlers accept the optional call-site `options` arg.

- [ ] **Step 1: Write the temporary G7 runtime check FIRST (red)**

The one behavior `tsc` can't prove: `crud.update(ctx, { id, data: {} })` must stop throwing and instead be a graceful **no-op** — return the current row, `updatedAt` UNCHANGED. Verify on a **hookless** entity (`voip-dids`) so nothing external fires. Create `scripts/tmp-verify-crud-a.ts`:

```ts
import './lib/load-env'

import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { voipDids } from '@/shared/db/schema'
import { voipDidServerSpec } from '@/shared/entities/voip-dids/lib/server-spec'

async function main() {
  const crud = createCrudDal(voipDidServerSpec)

  // Seed a row directly (bypass hooks). voip_dids' only NOT-NULL-without-default
  // cols are e164 + providerDidId, both UNIQUE — suffix them to avoid collisions.
  const suffix = String(Date.now())
  const [seed] = await db.insert(voipDids).values({
    e164: `+1555${suffix.slice(-7)}`,
    providerDidId: `tmp-verify-${suffix}`,
  } as never).returning()
  console.log('seeded', seed.id, 'updatedAt', seed.updatedAt)

  // G7: empty update is a graceful NO-OP — no throw, returns the row, updatedAt unchanged.
  const res = await crud.update(SYSTEM_CONTEXT, { id: seed.id, data: {} })
  if (!res.success) throw new Error(`G7 FAIL: empty update should be a no-op, got: ${JSON.stringify(res.error)}`)
  if (res.data.updatedAt !== seed.updatedAt) throw new Error('G7 FAIL: empty update bumped updatedAt (should be no-op)')

  await crud.delete(SYSTEM_CONTEXT, { id: seed.id })
  console.log('G7 PASS ✅ (empty update = no-op: no throw, no bump)')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Run it against the CURRENT engine to confirm G7 fails today**

Run: `pnpm tsx scripts/tmp-verify-crud-a.ts`
Expected: FAIL — the empty `crud.update` returns `{ success: false }` (today's `updateImpl` `.set({})` throws "No values to set" inside `dalDbOperation`, surfacing as `db-error`), tripping the first assertion. Proves the script detects the bug.

- [ ] **Step 3: Rewrite `create-crud-dal.ts` — imports, factory, `@deprecated synthesizeFromSpec`**

Add the config types to the `../types` import (`and`, `eq` from `drizzle-orm` are already imported; no new drizzle imports needed). New factory + adapter:

```ts
export function createCrudDal<TTable extends PgTable, TId extends string | number = string>(
  spec: EntityServerSpec<TTable, TId>,
  configFactory?: CrudConfigFactory<TTable, TId>,
): CrudHandlers<TTable, TId> {
  const pkColumn = getPkColumn(spec)
  const crudHandlers = {} as CrudHandlers<TTable, TId> // ← bootstrap cast (spec §2.3)
  const cfg: CrudConfig<TTable, TId> = configFactory
    ? configFactory(crudHandlers)
    : synthesizeFromSpec(spec, pkColumn)

  Object.assign(crudHandlers, {
    getById: (ctx: ScopedContext, input: { id: TId }) => getByIdImpl(spec, pkColumn, ctx, input),
    create: (ctx: ScopedContext, input: Insert<TTable>, options?: CrudCallsiteHooks<TTable, TId, 'create'>) =>
      createImpl(spec, cfg, ctx, input, options),
    update: (ctx: ScopedContext, input: { id: TId, data: Update<TTable> }, options?: CrudCallsiteHooks<TTable, TId, 'update'>) =>
      updateImpl(spec, cfg, pkColumn, ctx, input, options),
    delete: (ctx: ScopedContext, input: { id: TId }, options?: CrudCallsiteHooks<TTable, TId, 'delete'>) =>
      deleteImpl(spec, cfg, pkColumn, ctx, input, options),
    duplicate: (ctx: ScopedContext, input: { id: TId }, options?: CrudCallsiteHooks<TTable, TId, 'create'>) =>
      duplicateImpl(spec, cfg, pkColumn, ctx, input, options),
  })
  return crudHandlers
}

/**
 * @deprecated Sub-plan A shim. Rebuilds a `CrudConfig` from the deprecated
 * `spec.hooks`/`spec.duplicate` for entities not yet on a config factory.
 * REMOVED in Sub-plan D once `spec.hooks` is deleted — see
 * docs/superpowers/plans/2026-08-16-crud-dal-sub-plan-a-factory-config-hooks.md.
 *
 * create/update hooks pass through (their `void` afters are assignable to
 * `Row | void`); only `delete` needs bridging — the legacy hook takes `id`,
 * the new one takes the row, so we forward `row[pk]`.
 */
function synthesizeFromSpec<TTable extends PgTable, TId extends string | number>(
  spec: EntityServerSpec<TTable, TId>,
  pkColumn: PgColumn,
): CrudConfig<TTable, TId> {
  const h = spec.hooks
  const pkName = pkColumn.name
  const legacyDelete = h?.delete
  return {
    hooks: h && {
      create: h.create,
      update: h.update,
      delete: legacyDelete && {
        before: legacyDelete.before
          ? (row, ctx) => legacyDelete.before!((row as Record<string, unknown>)[pkName] as TId, ctx)
          : undefined,
        after: legacyDelete.after
          ? (row, ctx) => legacyDelete.after!((row as Record<string, unknown>)[pkName] as TId, ctx)
          : undefined,
      },
    },
    duplicate: spec.duplicate,
  }
}
```

> If TS rejects assigning `h.create`/`h.update` (bivariant spec methods) into `CrudHooks`, add `as CrudHooks<TTable, TId>` on the returned `hooks` object — the source is more permissive, so it should assign without it; try first.

- [ ] **Step 4: Rewrite `createImpl` (two-layer + threaded after, `db` direct)**

```ts
async function createImpl<TTable extends PgTable, TId extends string | number>(
  spec: EntityServerSpec<TTable, TId>,
  cfg: CrudConfig<TTable, TId>,
  ctx: ScopedContext,
  input: Insert<TTable>,
  callsite?: CrudCallsiteHooks<TTable, TId, 'create'>,
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    let data = input
    if (cfg.hooks?.create?.before) data = await cfg.hooks.create.before(data, ctx)
    if (callsite?.before) data = await callsite.before(data, ctx)
    const validated = spec.schemas.insert.parse(data) as Insert<TTable>

    const [inserted] = await db.insert(spec.table as PgTable).values(validated).returning()
    if (!inserted) {
      throw new ThrowableDalError({ type: 'create-failed' })
    }

    let result = inserted as Row<TTable>
    const meta: CreateAfterMeta<TTable> = { input }
    if (callsite?.after) result = (await callsite.after(result, ctx, meta)) ?? result
    if (cfg.hooks?.create?.after) result = (await cfg.hooks.create.after(result, ctx, meta)) ?? result
    return result
  })
}
```

- [ ] **Step 5: Rewrite `updateImpl` — empty update is a no-op (G7)**

The whole G7 fix: an update whose business data is empty (after before-hooks) writes nothing, so `updatedAt` does NOT move and no after-hooks fire — it returns the current row instead of throwing. Non-empty data uses `.set(validated)` exactly as today (Drizzle auto-appends `$onUpdate` columns, so `updatedAt` bumps only on a real write). This generalizes `updateProject`'s existing `hasFields` guard into the shared handler.

```ts
async function updateImpl<TTable extends PgTable, TId extends string | number>(
  spec: EntityServerSpec<TTable, TId>,
  cfg: CrudConfig<TTable, TId>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: TId, data: Update<TTable> },
  callsite?: CrudCallsiteHooks<TTable, TId, 'update'>,
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    // before: factory (outer) → callsite (inner), THREADED
    let data = input.data
    if (cfg.hooks?.update?.before) data = await cfg.hooks.update.before(data, ctx, { id: input.id })
    if (callsite?.before) data = await callsite.before(data, ctx, { id: input.id })
    const validated = spec.schemas.update.parse(data) as Update<TTable>

    // G7: empty update (no defined business columns, even after before-hooks) is a
    // NO-OP — nothing to write, so updatedAt does not move and after-hooks do not
    // fire (there is no write to react to). Return the current row. Generalizes
    // updateProject's long-standing hasFields guard (mutations.ts:65).
    const hasBusinessData = Object.values(validated as Record<string, unknown>).some(v => v !== undefined)
    if (!hasBusinessData) {
      const current = await getByIdImpl(spec, pkColumn, ctx, { id: input.id })
      if (!current.success) {
        throw new ThrowableDalError(current.error)
      }
      if (!current.data) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      return current.data as Row<TTable>
    }

    // prefetch previousRow if EITHER layer has an after (loud-abort BEFORE the write)
    const needsPrev = Boolean(cfg.hooks?.update?.after || callsite?.after)
    let previousRow: Row<TTable> | undefined
    if (needsPrev) {
      const prev = await getByIdImpl(spec, pkColumn, ctx, { id: input.id })
      if (!prev.success) {
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: `[create-crud-dal] previousRow prefetch failed for '${spec.entityName}' update — refusing to commit without after-hook context`,
        })
      }
      if (!prev.data) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      previousRow = prev.data as Row<TTable>
    }

    // Real write. `.set(validated)` — Drizzle filters undefined and auto-appends
    // $onUpdate columns (updatedAt bumps here, on a genuine change).
    const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
    const [updated] = await db.update(spec.table as PgTable).set(validated as Record<string, unknown>).where(where).returning()
    if (!updated) {
      throw new ThrowableDalError({ type: 'not-found' })
    }

    // after: callsite (inner) → factory (outer), THREADED via `?? result`
    let result = updated as Row<TTable>
    const meta: UpdateAfterMeta<TTable> = { previousRow: previousRow!, input: input.data }
    if (callsite?.after) result = (await callsite.after(result, ctx, meta)) ?? result
    if (cfg.hooks?.update?.after) result = (await cfg.hooks.update.after(result, ctx, meta)) ?? result
    return result
  })
}
```

- [ ] **Step 6: (no new helpers)**

The no-op fix needs no helper — the empty check is one inline `.some(...)` and the no-op returns `getByIdImpl`'s result. `seedOnUpdateColumns`/`unwrapRow`/`getTableColumns` are NOT introduced (this is the F5 simplification: no reaching into Drizzle internals). Skip to Step 7.

- [ ] **Step 7: Rewrite `deleteImpl` with G4 delete-row**

```ts
async function deleteImpl<TTable extends PgTable, TId extends string | number>(
  spec: EntityServerSpec<TTable, TId>,
  cfg: CrudConfig<TTable, TId>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: TId },
  callsite?: CrudCallsiteHooks<TTable, TId, 'delete'>,
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    const needsRow = Boolean(
      cfg.hooks?.delete?.before || cfg.hooks?.delete?.after || callsite?.before || callsite?.after,
    )
    let row: Row<TTable> | undefined
    if (needsRow) {
      const pre = await getByIdImpl(spec, pkColumn, ctx, { id: input.id })
      if (!pre.success) {
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: `[create-crud-dal] delete-row prefetch failed for '${spec.entityName}' — refusing to delete without hook context`,
        })
      }
      if (!pre.data) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      row = pre.data as Row<TTable>
    }

    if (cfg.hooks?.delete?.before) await cfg.hooks.delete.before(row!, ctx) // pre-DELETE
    if (callsite?.before) await callsite.before(row!, ctx)

    const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
    const deleted = await db.delete(spec.table as PgTable).where(where).returning({ id: pkColumn })
    if (deleted.length === 0) {
      throw new ThrowableDalError({ type: 'not-found' })
    }

    if (callsite?.after) await callsite.after(row!, ctx)
    if (cfg.hooks?.delete?.after) await cfg.hooks.delete.after(row!, ctx)
  })
}
```

- [ ] **Step 8: Rewrite `duplicateImpl` to read `cfg.duplicate` + thread `cfg`**

```ts
async function duplicateImpl<TTable extends PgTable, TId extends string | number>(
  spec: EntityServerSpec<TTable, TId>,
  cfg: CrudConfig<TTable, TId>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: TId },
  callsite?: CrudCallsiteHooks<TTable, TId, 'create'>,
): Promise<DalReturn<Row<TTable>>> {
  const srcResult = await getByIdImpl(spec, pkColumn, ctx, input)
  if (!srcResult.success) {
    return srcResult
  }
  const source = srcResult.data
  if (!source) {
    return { success: false, error: { type: 'not-found' } }
  }

  const pkName = pkColumn.name
  const excludeSet = new Set<string>([pkName, ...(cfg.duplicate?.exclude ?? [])])
  const base = Object.fromEntries(
    Object.entries(source as Record<string, unknown>)
      .filter(([key]) => !excludeSet.has(key))
      .map(([key, val]) => [key, val === null ? undefined : val]),
  )
  const overrides = cfg.duplicate?.overrides?.(source, ctx) ?? {}
  const insertData = { ...base, ...overrides } as Insert<TTable>

  return createImpl(spec, cfg, ctx, insertData, callsite)
}
```

> `getByIdImpl(spec, pkColumn, ctx, input)` keeps its current signature — leave it unchanged.

- [ ] **Step 9: Verify types green**

Run: `pnpm tsc`
Expected: PASS. Existing callers pass no `configFactory` → `synthesizeFromSpec`; routers/cruds unaffected. Fix any error inline (most likely the bivariance assignment in `synthesizeFromSpec` — apply the noted `as` if needed).

- [ ] **Step 10: Verify G7 green (runtime)**

Run: `pnpm tsx scripts/tmp-verify-crud-a.ts`
Expected: PASS — prints `G7 PASS ✅`; the empty update is a no-op (no throw, `updatedAt` unchanged).

- [ ] **Step 11: Lint + commit (keep the tmp script for Task 4)**

Run: `pnpm lint`
Expected: PASS.

```bash
git add src/shared/dal/server/lib/create-crud-dal.ts
git commit -m "feat(dal): config-factory engine + G7 empty-update + G4 delete-row (crud-dal sub-plan A)"
```

Leave `scripts/tmp-verify-crud-a.ts` uncommitted (extended in Task 4, deleted before Task 4's commit).

---

## Task 3: `create-crud-router.ts` — require `crud`, delete the internal rebuild

No fallback, no dead weight. `createCrudRouter` consumes the entity's single hooked instance; the internal `createCrudDal(config.spec)` rebuild (the hookless-rebuild back door) is deleted. All 5 call sites pass their **already-existing** `*Crud`. Zero behavior change (an unmigrated entity's `createCrudDal(spec)` synthesizes hooks identically). Atomic — required-field + all 5 wirings land together.

**Files:**
- Modify: `src/trpc/lib/create-crud-router.ts` (config interface `:60`; handler construction `:70,75`; drop `createCrudDal` import `:23`)
- Modify: `src/trpc/routers/applications.router/crud.router.ts` (add `crud: applicationCrud`)
- Modify: `src/trpc/routers/customers.router/crud.router.ts` (add `crud: customerCrud`)
- Modify: `src/trpc/routers/proposals.router/crud.router.ts` (add `crud: proposalCrud`)
- Modify: `src/trpc/routers/customer-notes.router/index.ts` (add `crud: customerNoteCrud`)
- Modify: `src/trpc/routers/meetings.router/crud.router.ts` (add `crud: meetingCrud`)

**Interfaces:**
- Consumes: each entity's existing `*Crud` export (`applicationCrud`, `customerCrud`, `proposalCrud`, `customerNoteCrud`, `meetingCrud` from `@/shared/entities/<e>/dal/server/crud`).
- Produces: `CreateCrudRouterConfig` gains **required** `crud: CrudHandlers<TTable, TId>`.

- [ ] **Step 1: Make `crud` a required config field**

In `CreateCrudRouterConfig` (after `schemas`, before `handlers?`), add:

```ts
  /**
   * The entity's single CRUD instance, built once via
   * `createCrudDal(spec, configFactory)` in the entity's `dal/server/crud.ts`.
   * REQUIRED — the router never rebuilds handlers, so no code path can produce
   * un-hooked ones (the hookless-rebuild failure mode is eliminated by construction).
   */
  crud: CrudHandlers<TTable, TId>
```

- [ ] **Step 2: Consume `crud`, delete the internal build**

Replace the old lines 70–75 (`const defaults = createCrudDal(config.spec)` … `as CrudHandlers<TTable, TId>`) with:

```ts
  // Merge the entity's hooked instance with any bespoke slot overrides.
  const handlers = { ...config.crud, ...config.handlers } as CrudHandlers<TTable, TId>
```

Then delete the now-unused import `import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'` (line 23).

- [ ] **Step 3: Wire the 5 call sites**

Each already imports its spec; add the `*Crud` import and one `crud:` line. Exact edits:

`applications.router/crud.router.ts`:
```ts
import { applicationCrud } from '@/shared/entities/applications/dal/server/crud'
// ...
export const crudRouter = createCrudRouter({
  spec: applicationServerSpec,
  schemas: { /* unchanged */ },
  crud: applicationCrud,
})
```

`customers.router/crud.router.ts` (keep its existing `handlers:` block — it merges over `crud`):
```ts
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
// ...
export const crudRouter = createCrudRouter({
  spec: customerServerSpec,
  schemas: { /* unchanged */ },
  crud: customerCrud,
  handlers: { /* unchanged */ },
})
```

`proposals.router/crud.router.ts` (keep `handlers: { duplicate: duplicateProposalWithIncentives }`):
```ts
import { proposalCrud } from '@/shared/entities/proposals/dal/server/crud'
// ...
export const crudRouter = createCrudRouter({
  spec: proposalServerSpec,
  schemas: { /* unchanged */ },
  crud: proposalCrud,
  handlers: { duplicate: duplicateProposalWithIncentives },
})
```

`customer-notes.router/index.ts` — the outer `crud:` key is the sub-router tree slot; add the new required `crud:` field **inside** the `createCrudRouter({...})` config:
```ts
import { customerNoteCrud } from '@/shared/entities/customer-notes/dal/server/crud'
// ...
  crud: createCrudRouter({
    spec: customerNoteServerSpec,
    schemas: { /* unchanged */ },
    crud: customerNoteCrud,
  }),
```

`meetings.router/crud.router.ts`:
```ts
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
// ...
export const crudRouter = createCrudRouter({
  spec: meetingServerSpec,
  schemas: { ...meetingSchemas, id: z.string().uuid() },
  crud: meetingCrud,
})
```

- [ ] **Step 4: Verify green**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. Every router now passes its existing `*Crud` (still spec-synthesized at this point) — behavior identical to before, but the internal rebuild is gone.

- [ ] **Step 5: Commit**

```bash
git add src/trpc/lib/create-crud-router.ts src/trpc/routers/applications.router/crud.router.ts src/trpc/routers/customers.router/crud.router.ts src/trpc/routers/proposals.router/crud.router.ts src/trpc/routers/customer-notes.router/index.ts src/trpc/routers/meetings.router/crud.router.ts
git commit -m "refactor(trpc): require crud instance in createCrudRouter; drop hookless rebuild (crud-dal sub-plan A)"
```

---

## Task 4: Migrate meetings to the config factory (the proof)

Move meetings' hooks + duplicate off `lib/server-spec.ts` into `dal/server/crud.ts`'s config factory, rewrite `delete.before` to take the **row** (deleting its raw-`db` gcalEventId read — the G4 payoff), and note the sanctioned service-orchestration-in-DAL. The meetings router already passes `crud: meetingCrud` (Task 3), so it is not touched again.

**Files:**
- Modify: `src/shared/entities/meetings/lib/server-spec.ts` (strip hooks + duplicate + now-unused imports)
- Modify: `src/shared/entities/meetings/dal/server/crud.ts` (add config factory with all hook bodies + duplicate)
- Modify: `src/shared/entities/meetings/dal/DOCS.md` or entity `DOCS.md` (one line: crud.ts legitimately orchestrates services — hook home)
- Delete: `scripts/tmp-verify-crud-a.ts` (after the meetings G4 check)

**Interfaces:**
- Consumes: `createCrudDal` (2-arg form), `meetingServerSpec`, and everything the hooks need (`addParticipant`, `resolveMeetingOwnerId`, `getSystemOwnerId`, `OUTCOME_PIPELINE_MAP`, the QStash jobs, `ably`, `Meeting`).
- Produces: `meetingCrud` (unchanged export name) now built with a config factory; `meetingServerSpec` with no `hooks`/`duplicate`.

- [ ] **Step 1: Move hook + duplicate bodies into `dal/server/crud.ts`**

Rewrite `src/shared/entities/meetings/dal/server/crud.ts`. Copy the `create`/`update` hook bodies **verbatim** from `server-spec.ts:55–157`; rewrite **only** `delete.before` to take the row. Move `duplicate` across too:

```ts
import type { Meeting } from '@/shared/db/schema'

import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { OUTCOME_PIPELINE_MAP } from '@/shared/domains/pipelines/lib/outcome-pipeline-map'
import { addParticipant } from '@/shared/entities/meetings/dal/server/participants'
import { resolveMeetingOwnerId } from '@/shared/entities/meetings/lib/resolve-owner'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { getSystemOwnerId } from '@/shared/entities/users/dal/server/system'
import { deleteMeetingEventJob } from '@/shared/services/providers/upstash/jobs/delete-meeting-event'
import { graduateFromCampaignJob } from '@/shared/services/providers/upstash/jobs/graduate-from-campaign'
import { metaCapiEventJob } from '@/shared/services/providers/upstash/jobs/meta-capi-event'
import { notifyMeetingTimeChangedJob } from '@/shared/services/providers/upstash/jobs/notify-meeting-time-changed'
import { syncMeetingToGcalJob } from '@/shared/services/providers/upstash/jobs/sync-meeting-to-gcal'
import { ably } from '@/shared/services/providers/upstash/realtime'

/** Stable CRUD handlers for meetings. Hooks live here (config factory), not on the spec. */
export const meetingCrud = createCrudDal(meetingServerSpec, () => ({
  hooks: {
    create: {
      // ... paste create.before body verbatim from the old server-spec ...
      // ... paste create.after body verbatim ...
    },
    update: {
      // ... paste update.before body verbatim ...
      // ... paste update.after body verbatim ...
    },
    delete: {
      // G4: the row is prefetched by the engine and handed in — no raw db read.
      // (Keep the one-way GCal cleanup comment block from the original hook.)
      async before(row: Meeting) {
        if (row.gcalEventId) {
          await deleteMeetingEventJob.dispatchOrThrow({ gcalEventId: row.gcalEventId })
        }
      },
    },
  },
  duplicate: {
    // ... paste the duplicate.exclude array (and overrides, if any) verbatim ...
  },
}))
```

Notes:
- Factory arg omitted (`() =>`) — meetings' hooks need no same-entity crud reads.
- Preserve EVERY comment from the original hook bodies (owner resolution, graduation handoff, GCal taxonomy, one-way cleanup — they encode business rules).
- `create.after`/`update.after` keep returning nothing (void); the engine coalesces to the row.

- [ ] **Step 2: Strip hooks + duplicate + dead imports from `server-spec.ts`**

In `src/shared/entities/meetings/lib/server-spec.ts`, delete the whole `hooks: { ... }` and `duplicate: { ... }` properties. Remove now-unused imports — at minimum `db`, `eq`, `addParticipant`, `resolveMeetingOwnerId`, `getSystemOwnerId`, `OUTCOME_PIPELINE_MAP`, the five job imports, `ably`, and `Meeting` (if unused). Keep `meetings`, the schemas, `MEETING`, `meetingVisibility`. Result:

```ts
export const meetingServerSpec = {
  entityName: MEETING,
  caslSubject: MEETING,
  visibility: meetingVisibility,
  table: meetings,
  schemas: { insert: insertMeetingSchema, update: updateMeetingSchema, select: selectMeetingSchema },
} satisfies EntityServerSpec<typeof meetings>
```

(Keep `meetingSchemas` and the local `updateMeetingSchema` exactly as they are.)

- [ ] **Step 3: Verify types green + no import cycle**

Run: `pnpm tsc`
Expected: PASS. If a circular-import error appears (crud.ts ↔ a hook dependency), convert the offending import to `import type` or a lazy `await import(...)` at the hook boundary (spec §6), then re-run.

- [ ] **Step 4: Confirm no raw `db` remains in meetings hooks**

Run: `grep -n "from '@/shared/db'" src/shared/entities/meetings/lib/server-spec.ts src/shared/entities/meetings/dal/server/crud.ts`
Expected: **no match** — the circular-barrier win; the `delete.before` gcalEventId read is gone.

- [ ] **Step 5: Note the sanctioned service orchestration in DAL**

`crud.ts` now imports QStash jobs + `ably` — legitimate (it is the designated hook home), but new for a `dal/server/` file. Add one line to `src/shared/entities/meetings/dal/DOCS.md` (create the file if absent, following the nearest entity `DOCS.md` shape) under a short heading:

```md
## crud.ts orchestrates services (by design)
`dal/server/crud.ts` invokes services/QStash jobs from within its config-factory hooks — this is the sanctioned hook home (CRUD DAL mutation-interface epic), not a Rule-19 breach. Pure business logic still belongs in `lib/`.
```

- [ ] **Step 6: Extend the tmp script with the meetings G4 check + run**

Append a meetings block to `scripts/tmp-verify-crud-a.ts` before `main`'s exit — seed a meeting with `gcalEventId: null`, delete via `meetingCrud`, assert success (proves `delete.before(row)` ran, read `row.gcalEventId === null`, dispatched nothing):

```ts
// --- G4: meetings delete hook receives the row (no raw db) ---
const { meetingCrud } = await import('@/shared/entities/meetings/dal/server/crud')
const { meetings } = await import('@/shared/db/schema')
const ownerId = await (await import('@/shared/entities/users/dal/server/system')).getSystemOwnerId()
const [m] = await db.insert(meetings).values({
  ownerId,
  scheduledFor: new Date().toISOString(),
  gcalEventId: null,
} as never).returning()
const del = await meetingCrud.delete(SYSTEM_CONTEXT, { id: m.id })
if (!del.success) throw new Error(`G4 delete failed: ${JSON.stringify(del.error)}`)
console.log('G4 PASS ✅ (delete.before received the row, no raw db)')
```

Run: `pnpm tsx scripts/tmp-verify-crud-a.ts`
Expected: PASS — prints both `G7 PASS ✅` and `G4 PASS ✅`. (`gcalEventId: null` guarantees no QStash dispatch.)

- [ ] **Step 7: Delete the tmp script + final green sweep**

```bash
rm scripts/tmp-verify-crud-a.ts
```

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/shared/entities/meetings/lib/server-spec.ts src/shared/entities/meetings/dal/server/crud.ts src/shared/entities/meetings/dal/DOCS.md
git commit -m "refactor(meetings): relocate hooks to config factory; prove G4 delete-row (crud-dal sub-plan A)"
```

---

## Self-Review

**1. Spec coverage:**
- §2.1 spec identity + config factory + A/D boundary → Task 1 (types + `@deprecated`), Task 4 (meetings pure). ✅
- §2.2 `CrudConfig` shape (now single-sourced via `CrudSlotHookMap`) → Task 1 Steps 3–4. ✅
- §2.3 late-bound bootstrap + `synthesizeFromSpec` → Task 2 Step 3. ✅
- §2.4 two-layer onion + threaded after (`?? result`) → Task 2 Steps 4–5, 7. ✅
- §2.5 G7 empty-update → **no-op** (no throw, no `updatedAt` bump; generalizes `updateProject`'s guard) → Task 2 Step 5, verified Steps 2/10. No Drizzle-internal introspection. ✅
- §2.6 G4 delete-row → Task 2 Step 7; meetings payoff Task 4. ✅
- §2.7 call-site option types (with `afterCommit?` unused) → Task 1 Step 3 (`CrudCallsiteHooks`). ✅
- §2.8 `crud` on router → **required now** (Task 3), stronger than the spec's optional/deferred wording — eliminates the hookless-rebuild mode in A, not D. ✅ (spec updated to match)
- §2.9 casts → bootstrap + `row[pk]` in `synthesizeFromSpec` (Task 2); the `onUpdateFn` cast (G7 no-op) and the `ctx.tx` cast (seam deferred to B) are both **removed**. ✅
- §3 scope boundaries → Global Constraints (no tx seam, no afterCommit exec, no two-schema, meetings-only relocation). ✅
- §4 files → File Structure; unmigrated **specs** untouched (their routers gain one `crud:` line). ✅
- §5 done-when → Tasks 1–4 verification steps. ✅
- §6 risks → Task 4 Step 3 (import cycle), Task 2 Step 6 (Drizzle-version watch comment). ✅

**2. Placeholder scan:** The verbatim-paste points in Task 4 Step 1 are deliberate (the exact hook bodies at `server-spec.ts:55–157` must move unchanged; reproducing ~130 lines invites drift). The `.values({...})` seeds name the exact required columns. No other placeholders.

**3. Type consistency:** `createCrudDal(spec, configFactory?)`, `CrudSlotHookMap`, `CrudMutationSlot`, `CrudHooks`, `CrudCallsiteHooks<…, S>`, `CrudConfig`, `CrudConfigFactory`, `CreateAfterMeta`/`UpdateAfterMeta`, `synthesizeFromSpec`, `meetingCrud`/`applicationCrud`/`customerCrud`/`proposalCrud`/`customerNoteCrud` — names consistent across tasks. `getByIdImpl(spec, pkColumn, ctx, input)` unchanged. (No `seedOnUpdateColumns`/`unwrapRow` — G7 is an inline no-op.)

**Audit findings integrated (2026-08-17 convention-auditor):** F1 single-sourced hooks (lookup map) ✅ · F2 `crud` required now, 5 sites wired, fallback deleted ✅ · F3 `@deprecated` on `synthesizeFromSpec` + `EntityServerSpec.hooks`/`duplicate` ✅ · F4 `ctx.tx ?? db` seam deferred to B (no speculative cast) ✅ · **F5 dissolved** — G7 empty-update reworked to a **no-op** (user direction 2026-08-17): no `updatedAt` bump, no Drizzle-internal `onUpdateFn` reach, no `seedOnUpdateColumns`. ✅ · adjacent meetings-DAL-orchestration DOCS note ✅.

---

## Execution Notes

- **Landing order vs #285:** `types.ts` is a mechanical merge-conflict surface with the CASL scope-compiler epic (#285 strips `visibility`; A adds config types). Whichever lands second rebases — the changes are disjoint.
- **A stays on `main`.** Nine files across four commits; stage by path per task.
