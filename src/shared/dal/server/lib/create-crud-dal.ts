// ─── createCrudDal (DAL-layer CRUD factory) ────────────────────────────────
// Generate default CRUD DAL functions for an entity. Returns 5 handlers
// matching the CrudHandlers<TTable> interface. Each handler returns
// DalReturn<T> — never throws.
//
// Each handler applies `ctx.scope` for visibility-scoped WHERE clauses.
// Omni callers pass `scope: null`, skipping the predicate.
//
// Optionally accepts a `CrudConfigFactory` — a late-bound function that
// receives the crud handlers themselves (so hooks can call
// `crudHandlers.getById(...)` for same-entity reads) and returns a
// `CrudConfig` (factory-invariant hooks + duplicate config). Entities with no
// hooks pass no factory and get an empty `CrudConfig` ({}) — the plain
// row-level CRUD path with no side-effects.
//
// Two-layer hook onion per mutation: factory hooks (outer, entity-invariant)
// wrap call-site hooks (inner, invocation-specific) —
//   before: factory.before → callsite.before → validate → write
//   after:  write → callsite.after → factory.after
// `after` hooks may return a replacement row (threaded via `?? result`) or
// void (result unchanged).
//
// Override any slot by spreading the result and replacing individual keys:
// ```ts
// const defaults = createCrudDal(spec)
// const handlers = { ...defaults, create: customCreate }
// ```

import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type {
  CreateAfterMeta,
  CrudCallsiteHooks,
  CrudConfig,
  CrudConfigFactory,
  CrudHandlers,
  DalReturn,
  EntityServerSpec,
  ScopedContext,
  UpdateAfterMeta,
} from '../types'
import type { Insert, Row, Update } from '@/shared/db/types'

import { and, eq } from 'drizzle-orm'

import { db } from '@/shared/db'

import { ThrowableDalError } from '../types'
import { dalDbOperation } from './helpers'

export function createCrudDal<TTable extends PgTable, TId extends string | number = string>(
  spec: EntityServerSpec<TTable, TId>,
  configFactory?: CrudConfigFactory<TTable, TId>,
): CrudHandlers<TTable, TId> {
  const pkColumn = getPkColumn(spec)
  const crudHandlers = {} as CrudHandlers<TTable, TId> // ← bootstrap cast (spec §2.3)
  const cfg: CrudConfig<TTable, TId> = configFactory
    ? configFactory(crudHandlers)
    : {}

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

// ── getById ──────────────────────────────────────────────────────────────

async function getByIdImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number },
): Promise<DalReturn<Row<TTable> | undefined>> {
  return dalDbOperation(async () => {
    const exec = ctx.tx ?? db
    const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
    const [row] = await exec
      .select()
      .from(spec.table as PgTable)
      .where(where)
      .limit(1)
    return row as Row<TTable> | undefined
  })
}

// ── create ───────────────────────────────────────────────────────────────

async function createImpl<TTable extends PgTable, TId extends string | number>(
  spec: EntityServerSpec<TTable, TId>,
  cfg: CrudConfig<TTable, TId>,
  ctx: ScopedContext,
  input: Insert<TTable>,
  callsite?: CrudCallsiteHooks<TTable, TId, 'create'>,
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    const exec = ctx.tx ?? db
    let data = input
    if (cfg.hooks?.create?.before)
      data = await cfg.hooks.create.before(data, ctx)
    if (callsite?.before)
      data = await callsite.before(data, ctx)
    const validated = spec.schemas.insert.parse(data) as Insert<TTable>

    const [inserted] = await exec.insert(spec.table as PgTable).values(validated).returning()
    if (!inserted) {
      throw new ThrowableDalError({ type: 'create-failed' })
    }

    let result = inserted as Row<TTable>
    const meta: CreateAfterMeta<TTable> = { input }
    if (callsite?.after)
      result = (await callsite.after(result, ctx, meta)) ?? result
    if (cfg.hooks?.create?.after)
      result = (await cfg.hooks.create.after(result, ctx, meta)) ?? result
    return result
  })
}

// ── update ───────────────────────────────────────────────────────────────

async function updateImpl<TTable extends PgTable, TId extends string | number>(
  spec: EntityServerSpec<TTable, TId>,
  cfg: CrudConfig<TTable, TId>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: TId, data: Update<TTable> },
  callsite?: CrudCallsiteHooks<TTable, TId, 'update'>,
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    const exec = ctx.tx ?? db
    // before: factory (outer) → callsite (inner), THREADED
    let data = input.data
    if (cfg.hooks?.update?.before)
      data = await cfg.hooks.update.before(data, ctx, { id: input.id })
    if (callsite?.before)
      data = await callsite.before(data, ctx, { id: input.id })
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
      return current.data
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
    const [updated] = await exec.update(spec.table as PgTable).set(validated as Record<string, unknown>).where(where).returning()
    if (!updated) {
      throw new ThrowableDalError({ type: 'not-found' })
    }

    // after: callsite (inner) → factory (outer), THREADED via `?? result`
    let result = updated as Row<TTable>
    const meta: UpdateAfterMeta<TTable> = { previousRow: previousRow!, input: input.data }
    if (callsite?.after)
      result = (await callsite.after(result, ctx, meta)) ?? result
    if (cfg.hooks?.update?.after)
      result = (await cfg.hooks.update.after(result, ctx, meta)) ?? result
    return result
  })
}

// ── delete ───────────────────────────────────────────────────────────────

async function deleteImpl<TTable extends PgTable, TId extends string | number>(
  spec: EntityServerSpec<TTable, TId>,
  cfg: CrudConfig<TTable, TId>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: TId },
  callsite?: CrudCallsiteHooks<TTable, TId, 'delete'>,
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    const exec = ctx.tx ?? db
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

    if (cfg.hooks?.delete?.before)
      await cfg.hooks.delete.before(row!, ctx) // pre-DELETE
    if (callsite?.before)
      await callsite.before(row!, ctx)

    const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
    const deleted = await exec.delete(spec.table as PgTable).where(where).returning({ id: pkColumn })
    if (deleted.length === 0) {
      throw new ThrowableDalError({ type: 'not-found' })
    }

    if (callsite?.after)
      await callsite.after(row!, ctx)
    if (cfg.hooks?.delete?.after)
      await cfg.hooks.delete.after(row!, ctx)
  })
}

// ── duplicate ────────────────────────────────────────────────────────────

async function duplicateImpl<TTable extends PgTable, TId extends string | number>(
  spec: EntityServerSpec<TTable, TId>,
  cfg: CrudConfig<TTable, TId>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: TId },
  callsite?: CrudCallsiteHooks<TTable, TId, 'create'>,
): Promise<DalReturn<Row<TTable>>> {
  // 1. Fetch source row
  const srcResult = await getByIdImpl(spec, pkColumn, ctx, input)
  if (!srcResult.success) {
    return srcResult
  }
  const source = srcResult.data
  if (!source) {
    return { success: false, error: { type: 'not-found' } }
  }

  // 2. Copy full row, drop PK + excluded fields, convert null → undefined
  // DB rows use null for absent nullable columns; insert schemas use
  // .optional() which accepts undefined but rejects null.
  const pkName = spec.primaryKey ?? 'id'
  const excludeSet = new Set<string>([pkName, ...(cfg.duplicate?.exclude ?? [])])
  const base = Object.fromEntries(
    Object.entries(source as Record<string, unknown>)
      .filter(([key]) => !excludeSet.has(key))
      .map(([key, val]) => [key, val === null ? undefined : val]),
  )

  // 3. Apply overrides
  const overrides = cfg.duplicate?.overrides?.(source, ctx) ?? {}
  const insertData = { ...base, ...overrides } as Insert<TTable>

  // 4. Route through createImpl — create.before + create.after fire automatically
  return createImpl(spec, cfg, ctx, insertData, callsite)
}

// ── helpers ──────────────────────────────────────────────────────────────

function getPkColumn<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
): PgColumn {
  const pkName = spec.primaryKey ?? 'id'
  const table = spec.table as unknown as Record<string, PgColumn>
  const column = table[pkName]
  if (!column) {
    throw new Error(
      `[create-crud-dal] Spec for '${spec.entityName}' references primary key `
      + `column '${pkName}' which is not on its table.`,
    )
  }
  return column
}
