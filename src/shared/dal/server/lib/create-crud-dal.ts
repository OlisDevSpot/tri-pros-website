// ─── createCrudDal (DAL-layer CRUD factory) ────────────────────────────────
// Generate default CRUD DAL functions for an entity. Returns 5 handlers
// matching the CrudHandlers<TTable> interface. Each handler returns
// DalReturn<T> — never throws.
//
// Each handler applies `ctx.scope` for visibility-scoped WHERE clauses.
// Omni callers pass `scope: null`, skipping the predicate.
//
// Override any slot by spreading the result and replacing individual keys:
// ```ts
// const defaults = createCrudDal(spec)
// const handlers = { ...defaults, create: customCreate }
// ```

import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type {
  CrudHandlers,
  DalReturn,
  EntityServerSpec,
  ScopedContext,
} from './types'
import type { Insert, Row, Update } from '@/shared/db/types'

import { and, eq } from 'drizzle-orm'

import { db } from '@/shared/db'

import { dalDbOperation } from './helpers'
import { ThrowableDalError } from './types'

export function createCrudDal<TTable extends PgTable, TId extends string | number = string>(
  spec: EntityServerSpec<TTable, TId>,
): CrudHandlers<TTable, TId> {
  const pkColumn = getPkColumn(spec)

  return {
    getById: (ctx, input) => getByIdImpl(spec, pkColumn, ctx, input),
    create: (ctx, input) => createImpl(spec, ctx, input),
    update: (ctx, input) => updateImpl(spec, pkColumn, ctx, input),
    delete: (ctx, input) => deleteImpl(spec, pkColumn, ctx, input),
    duplicate: (ctx, input) => duplicateImpl(spec, pkColumn, ctx, input),
  }
}

// ── getById ──────────────────────────────────────────────────────────────

async function getByIdImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number },
): Promise<DalReturn<Row<TTable> | undefined>> {
  return dalDbOperation(async () => {
    const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
    const [row] = await db
      .select()
      .from(spec.table as PgTable)
      .where(where)
      .limit(1)
    return row as Row<TTable> | undefined
  })
}

// ── create ───────────────────────────────────────────────────────────────

async function createImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  _ctx: ScopedContext,
  input: Insert<TTable>,
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    const validated = spec.schemas.insert.parse(input) as Insert<TTable>
    const [row] = await db
      .insert(spec.table as PgTable)
      .values(validated)
      .returning()
    if (!row) {
      throw new ThrowableDalError({ type: 'create-failed' })
    }
    return row as Row<TTable>
  })
}

// ── update ───────────────────────────────────────────────────────────────

async function updateImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number, data: Update<TTable> },
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    const validated = spec.schemas.update.parse(input.data) as Update<TTable>
    const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
    const [row] = await db
      .update(spec.table as PgTable)
      .set(validated as Record<string, unknown>)
      .where(where)
      .returning()
    if (!row) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    return row as Row<TTable>
  })
}

// ── delete ───────────────────────────────────────────────────────────────

async function deleteImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number },
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
    const deleted = await db
      .delete(spec.table as PgTable)
      .where(where)
      .returning({ id: pkColumn })
    if (deleted.length === 0) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
  })
}

// ── duplicate ────────────────────────────────────────────────────────────

async function duplicateImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number },
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    const srcResult = await getByIdImpl(spec, pkColumn, ctx, input)
    if (!srcResult.success) {
      throw new ThrowableDalError(srcResult.error)
    }
    const source = srcResult.data
    if (!source) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    const pkName = spec.primaryKey ?? 'id'
    const { [pkName]: _droppedPk, ...rest } = source as Record<string, unknown>
    const [row] = await db
      .insert(spec.table as PgTable)
      .values(rest as Record<string, unknown>)
      .returning()
    if (!row) {
      throw new ThrowableDalError({ type: 'duplicate-failed' })
    }
    return row as Row<TTable>
  })
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
