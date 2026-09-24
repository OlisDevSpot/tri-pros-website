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
  SpecCrudHandlers,
  SpecId,
  SpecInsert,
  SpecUpdate,
  UpdateAfterMeta,
} from '../types'
import type { Insert, Row, Update } from '@/shared/db/types'

import { and, eq } from 'drizzle-orm'

import { db } from '@/shared/db'

import { ThrowableDalError } from '../types'
import { dalDbOperation } from './helpers'

// Generic over the spec, not the table, so handler payload types are the spec's Zod inputs.
export function createCrudDal<TSpec extends EntityServerSpec<any, any>>(
  spec: TSpec,
  configFactory?: CrudConfigFactory<TSpec['table'], SpecId<TSpec>, SpecInsert<TSpec>, SpecUpdate<TSpec>>,
): SpecCrudHandlers<TSpec> {
  type TTable = TSpec['table']
  type TId = SpecId<TSpec>
  type TInsert = SpecInsert<TSpec>
  type TUpdate = SpecUpdate<TSpec>
  const pkColumn = getPkColumn(spec)
  const crudHandlers = {} as CrudHandlers<TTable, TId, TInsert, TUpdate> // ← bootstrap cast (spec §2.3)
  const cfg: CrudConfig<TTable, TId, TInsert, TUpdate> = configFactory
    ? configFactory(crudHandlers)
    : {}

  Object.assign(crudHandlers, {
    getById: (ctx: ScopedContext, input: { id: TId }) => getByIdImpl<TTable>(spec, pkColumn, ctx, input),
    create: (ctx: ScopedContext, input: TInsert, options?: CrudCallsiteHooks<TTable, TId, 'create', TInsert, TUpdate>) =>
      createImpl<TTable, TId, TInsert, TUpdate>(spec, cfg, ctx, input, options),
    update: (ctx: ScopedContext, input: { id: TId, data: TUpdate }, options?: CrudCallsiteHooks<TTable, TId, 'update', TInsert, TUpdate>) =>
      updateImpl<TTable, TId, TInsert, TUpdate>(spec, cfg, pkColumn, ctx, input, options),
    delete: (ctx: ScopedContext, input: { id: TId }, options?: CrudCallsiteHooks<TTable, TId, 'delete', TInsert, TUpdate>) =>
      deleteImpl<TTable, TId, TInsert, TUpdate>(spec, cfg, pkColumn, ctx, input, options),
    duplicate: (ctx: ScopedContext, input: { id: TId }, options?: CrudCallsiteHooks<TTable, TId, 'create', TInsert, TUpdate>) =>
      duplicateImpl<TTable, TId, TInsert, TUpdate>(spec, cfg, pkColumn, ctx, input, options),
  })
  return crudHandlers
}

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

async function createImpl<TTable extends PgTable, TId extends string | number, TInsert, TUpdate>(
  spec: EntityServerSpec<TTable, TId>,
  cfg: CrudConfig<TTable, TId, TInsert, TUpdate>,
  ctx: ScopedContext,
  input: TInsert,
  callsite?: CrudCallsiteHooks<TTable, TId, 'create', TInsert, TUpdate>,
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
    const meta: CreateAfterMeta<TTable, TInsert> = { input }
    if (callsite?.after)
      result = (await callsite.after(result, ctx, meta)) ?? result
    if (cfg.hooks?.create?.after)
      result = (await cfg.hooks.create.after(result, ctx, meta)) ?? result
    return result
  })
}

async function updateImpl<TTable extends PgTable, TId extends string | number, TInsert, TUpdate>(
  spec: EntityServerSpec<TTable, TId>,
  cfg: CrudConfig<TTable, TId, TInsert, TUpdate>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: TId, data: TUpdate },
  callsite?: CrudCallsiteHooks<TTable, TId, 'update', TInsert, TUpdate>,
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    const exec = ctx.tx ?? db
    let data = input.data
    if (cfg.hooks?.update?.before)
      data = await cfg.hooks.update.before(data, ctx, { id: input.id })
    if (callsite?.before)
      data = await callsite.before(data, ctx, { id: input.id })
    const validated = spec.schemas.update.parse(data) as Update<TTable>

    // An empty update is a no-op: updatedAt must not move and after-hooks must not fire.
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

    // Prefetched before the write so a failed prefetch aborts with nothing written.
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

    // Drizzle drops undefined keys and appends $onUpdate columns here (updatedAt bumps).
    const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
    const [updated] = await exec.update(spec.table as PgTable).set(validated as Record<string, unknown>).where(where).returning()
    if (!updated) {
      throw new ThrowableDalError({ type: 'not-found' })
    }

    let result = updated as Row<TTable>
    const meta: UpdateAfterMeta<TTable, TUpdate> = { previousRow: previousRow!, input: input.data }
    if (callsite?.after)
      result = (await callsite.after(result, ctx, meta)) ?? result
    if (cfg.hooks?.update?.after)
      result = (await cfg.hooks.update.after(result, ctx, meta)) ?? result
    return result
  })
}

async function deleteImpl<TTable extends PgTable, TId extends string | number, TInsert, TUpdate>(
  spec: EntityServerSpec<TTable, TId>,
  cfg: CrudConfig<TTable, TId, TInsert, TUpdate>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: TId },
  callsite?: CrudCallsiteHooks<TTable, TId, 'delete', TInsert, TUpdate>,
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

async function duplicateImpl<TTable extends PgTable, TId extends string | number, TInsert, TUpdate>(
  spec: EntityServerSpec<TTable, TId>,
  cfg: CrudConfig<TTable, TId, TInsert, TUpdate>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: TId },
  callsite?: CrudCallsiteHooks<TTable, TId, 'create', TInsert, TUpdate>,
): Promise<DalReturn<Row<TTable>>> {
  const srcResult = await getByIdImpl(spec, pkColumn, ctx, input)
  if (!srcResult.success) {
    return srcResult
  }
  const source = srcResult.data
  if (!source) {
    return { success: false, error: { type: 'not-found' } }
  }

  // null → undefined: insert schemas use .optional(), which rejects null.
  const pkName = spec.primaryKey ?? 'id'
  const excludeSet = new Set<string>([pkName, ...(cfg.duplicate?.exclude ?? [])])
  const base = Object.fromEntries(
    Object.entries(source as Record<string, unknown>)
      .filter(([key]) => !excludeSet.has(key))
      .map(([key, val]) => [key, val === null ? undefined : val]),
  )

  const overrides = cfg.duplicate?.overrides?.(source, ctx) ?? {}
  const insertData = { ...base, ...overrides } as unknown as TInsert

  return createImpl<TTable, TId, TInsert, TUpdate>(spec, cfg, ctx, insertData, callsite)
}

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
