import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type {
  AnyServerSpec,
  CreateAfterMeta,
  CrudCallsiteHooks,
  CrudConfig,
  CrudConfigFactory,
  CrudHandlers,
  DalReturn,
  ScopedContext,
  SpecCrudHandlers,
  SpecId,
  SpecInsert,
  SpecUpdate,
  UpdateAfterMeta,
} from '../types'
import type { Insert, Row, Update } from '@/shared/db/types'
import type { ServerSpec } from '@/shared/domains/permissions/specs'
import type { CrudAction } from '@/shared/domains/permissions/types'

import { and, eq } from 'drizzle-orm'

import { db } from '@/shared/db'

import { ThrowableDalError } from '../types'
import { dalDbOperation } from './helpers'
import { assertGranted, columnKeyOf, reachFor, rootRowFor } from './permissions/core'
import { projectToReadFields } from './permissions/project'
import { isCompiled } from './scope'

/**
 * How a slot narrows its rows while the legacy engine and the compiled rules coexist: a converted
 * family answers through `permit`, the others through the `ctx.scope` their procedures resolved.
 */
interface Scoping {
  read: (ctx: ScopedContext) => SQL | undefined
  write: (ctx: ScopedContext, action: 'update' | 'delete') => SQL | undefined
  /** Forbidden when the actor has no rule at all for the slot's action. */
  assert: (ctx: ScopedContext, action: CrudAction) => void
  /** Each changed column against the loaded row, or against the root parent's row for a sub-entity. */
  assertColumns: (ctx: ScopedContext, row: Record<string, unknown>, columns: string[]) => Promise<void>
  /** A create under a parent: readable for an entity with a parent, updatable on this field for a sub-entity. A miss is not found. */
  assertParentReachable: (ctx: ScopedContext, input: Record<string, unknown>) => Promise<void>
  /** Always loaded before an update, so the columns can be checked against it. */
  loadsRowBeforeUpdate: boolean
  project: (ctx: ScopedContext, row: Record<string, unknown>) => Record<string, unknown>
}

const legacyScoping: Scoping = {
  read: ctx => ctx.scope ?? undefined,
  write: ctx => ctx.scope ?? undefined,
  assert: () => {},
  assertColumns: async () => {},
  assertParentReachable: async () => {},
  loadsRowBeforeUpdate: false,
  project: (_ctx, row) => row,
}

function compiledScoping(spec: AnyServerSpec): Scoping {
  return {
    read: ctx => reachFor(ctx, 'read', spec).sql,
    write: (ctx, action) => reachFor(ctx, action, spec).sql,
    assert: (ctx, action) => assertGranted(ctx.actor.ability, action, spec),
    assertColumns: async (ctx, row, columns) => {
      const target = await rootRowFor(ctx, spec, row)
      for (const column of columns) {
        if (!reachFor(ctx, 'update', spec, [column]).test(target)) {
          throw new ThrowableDalError({ type: 'forbidden', field: `${spec.entityName}.${column}` })
        }
      }
    },
    assertParentReachable: async (ctx, input) => {
      if (!spec.parent) {
        return
      }
      const parentId = input[columnKeyOf(spec.table as PgTable, spec.parent.fk)] as string | number
      const reach = 'subject' in spec
        ? reachFor(ctx, 'read', spec.parent.spec)
        : reachFor(ctx, 'update', spec.parent.spec, [spec.parent.field])
      if (!(await reach.probe(parentId))) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
    },
    loadsRowBeforeUpdate: true,
    project: (ctx, row) => projectToReadFields(ctx.actor.ability, spec, row),
  }
}

// Generic over the spec, not the table, so handler payload types are the spec's Zod inputs.
// Only a listed spec can be enforced: the rules are typed against the list, and a spec outside it has no subject they can name.
export function createCrudDal<TSpec extends ServerSpec>(
  spec: TSpec,
  configFactory?: CrudConfigFactory<TSpec['table'], SpecId<TSpec>, SpecInsert<TSpec>, SpecUpdate<TSpec>>,
): SpecCrudHandlers<TSpec> {
  type TTable = TSpec['table']
  type TId = SpecId<TSpec>
  type TInsert = SpecInsert<TSpec>
  type TUpdate = SpecUpdate<TSpec>
  const pkColumn = getPkColumn<TTable>(spec)
  const scoping = isCompiled(spec) ? compiledScoping(spec) : legacyScoping
  const crudHandlers = {} as CrudHandlers<TTable, TId, TInsert, TUpdate> // ← bootstrap cast (spec §2.3)
  const cfg: CrudConfig<TTable, TId, TInsert, TUpdate> = configFactory
    ? configFactory(crudHandlers)
    : {}

  Object.assign(crudHandlers, {
    getById: (ctx: ScopedContext, input: { id: TId }) => getByIdImpl<TTable>(spec, scoping, pkColumn, ctx, input),
    create: (ctx: ScopedContext, input: TInsert, options?: CrudCallsiteHooks<TTable, TId, 'create', TInsert, TUpdate>) =>
      createImpl<TTable, TId, TInsert, TUpdate>(spec, scoping, cfg, ctx, input, options),
    update: (ctx: ScopedContext, input: { id: TId, data: TUpdate }, options?: CrudCallsiteHooks<TTable, TId, 'update', TInsert, TUpdate>) =>
      updateImpl<TTable, TId, TInsert, TUpdate>(spec, scoping, cfg, pkColumn, ctx, input, options),
    delete: (ctx: ScopedContext, input: { id: TId }, options?: CrudCallsiteHooks<TTable, TId, 'delete', TInsert, TUpdate>) =>
      deleteImpl<TTable, TId, TInsert, TUpdate>(spec, scoping, cfg, pkColumn, ctx, input, options),
    duplicate: (ctx: ScopedContext, input: { id: TId }, options?: CrudCallsiteHooks<TTable, TId, 'create', TInsert, TUpdate>) =>
      duplicateImpl<TTable, TId, TInsert, TUpdate>(spec, scoping, cfg, pkColumn, ctx, input, options),
  })
  return crudHandlers
}

async function getByIdImpl<TTable extends PgTable>(
  spec: AnyServerSpec<TTable>,
  scoping: Scoping,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number },
): Promise<DalReturn<Row<TTable> | undefined>> {
  return dalDbOperation(async () => {
    scoping.assert(ctx, 'read')
    const exec = ctx.tx ?? db
    const where = and(eq(pkColumn, input.id), scoping.read(ctx))
    const [row] = await exec
      .select()
      .from(spec.table as PgTable)
      .where(where)
      .limit(1)
    return row ? scoping.project(ctx, row) as Row<TTable> : undefined
  })
}

async function createImpl<TTable extends PgTable, TId extends string | number, TInsert, TUpdate>(
  spec: AnyServerSpec<TTable>,
  scoping: Scoping,
  cfg: CrudConfig<TTable, TId, TInsert, TUpdate>,
  ctx: ScopedContext,
  input: TInsert,
  callsite?: CrudCallsiteHooks<TTable, TId, 'create', TInsert, TUpdate>,
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    scoping.assert(ctx, 'create')
    const exec = ctx.tx ?? db
    let data = input
    if (cfg.hooks?.create?.before)
      data = await cfg.hooks.create.before(data, ctx)
    if (callsite?.before)
      data = await callsite.before(data, ctx)
    const validated = spec.schemas.insert.parse(data) as Insert<TTable>
    await scoping.assertParentReachable(ctx, validated as Record<string, unknown>)

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
  spec: AnyServerSpec<TTable>,
  scoping: Scoping,
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
    const changed = Object.entries(validated as Record<string, unknown>).filter(([, value]) => value !== undefined).map(([key]) => key)
    if (changed.length === 0) {
      const current = await getByIdImpl(spec, scoping, pkColumn, ctx, { id: input.id })
      if (!current.success) {
        throw new ThrowableDalError(current.error)
      }
      if (!current.data) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      return current.data
    }

    // Prefetched before the write so a failed prefetch aborts with nothing written; the compiled
    // engine always needs the row, to check each changed column against it.
    const needsPrev = scoping.loadsRowBeforeUpdate || Boolean(cfg.hooks?.update?.after || callsite?.after)
    let previousRow: Row<TTable> | undefined
    if (needsPrev) {
      const prev = await getByIdImpl(spec, scoping, pkColumn, ctx, { id: input.id })
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
      await scoping.assertColumns(ctx, previousRow as Record<string, unknown>, changed)
    }

    // Drizzle drops undefined keys and appends $onUpdate columns here (updatedAt bumps).
    const where = and(eq(pkColumn, input.id), scoping.write(ctx, 'update'))
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
  spec: AnyServerSpec<TTable>,
  scoping: Scoping,
  cfg: CrudConfig<TTable, TId, TInsert, TUpdate>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: TId },
  callsite?: CrudCallsiteHooks<TTable, TId, 'delete', TInsert, TUpdate>,
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    scoping.assert(ctx, 'delete')
    const exec = ctx.tx ?? db
    const needsRow = Boolean(
      cfg.hooks?.delete?.before || cfg.hooks?.delete?.after || callsite?.before || callsite?.after,
    )
    let row: Row<TTable> | undefined
    if (needsRow) {
      const pre = await getByIdImpl(spec, scoping, pkColumn, ctx, { id: input.id })
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

    const where = and(eq(pkColumn, input.id), scoping.write(ctx, 'delete'))
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
  spec: AnyServerSpec<TTable>,
  scoping: Scoping,
  cfg: CrudConfig<TTable, TId, TInsert, TUpdate>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: TId },
  callsite?: CrudCallsiteHooks<TTable, TId, 'create', TInsert, TUpdate>,
): Promise<DalReturn<Row<TTable>>> {
  const srcResult = await getByIdImpl(spec, scoping, pkColumn, ctx, input)
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

  const created = await createImpl<TTable, TId, TInsert, TUpdate>(spec, scoping, cfg, ctx, insertData, callsite)
  if (!created.success || !cfg.duplicate?.after) {
    return created
  }

  // duplicate.after — the seam for cloning child rows the row copy cannot see.
  // Runs inside dalDbOperation so a ThrowableDalError from the hook becomes a
  // structured DalError instead of escaping as a throw.
  const after = cfg.duplicate.after
  return dalDbOperation(async () => (await after(created.data, ctx, { source })) ?? created.data)
}

function getPkColumn<TTable extends PgTable>(
  spec: AnyServerSpec<TTable>,
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
