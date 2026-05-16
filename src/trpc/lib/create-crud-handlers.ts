// ─── createCrudHandlers (L0) ────────────────────────────────────────────────
// Raw CRUD handler functions for an EntityServerSpec. Returns
// CrudHandlers<TTable> with list/getById/create/update/delete/duplicate.
//
// Composable from anywhere: business plugins (L2), RSC paths, jobs, scripts.
// No tRPC dependency. Throws domain errors (Error('NotFound'), etc.) which
// L1 maps to TRPCError.

import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { Insert, Row, Update } from '@/shared/db/types'
import type {
  AgentCtx,
  CrudHandlers,
  EntityServerSpec,
  ListInput,
  PaginatedResult,
  PkField,
} from '@/trpc/types'

import { and, asc, desc, eq } from 'drizzle-orm'

import { paginate } from '@/shared/dal/server/query/output'
import { buildSearchWhere } from '@/shared/dal/server/query/search'
import { buildOrderBy } from '@/shared/dal/server/query/sort'
import { db } from '@/shared/db'

/**
 * L0 factory. Returns fully-wired CRUD handlers that apply visibility
 * scoping uniformly.
 */
export function createCrudHandlers<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
): CrudHandlers<TTable> {
  const pkColumn = getPkColumn(spec)

  return {
    list: async (ctx, input) => listImpl(spec, ctx, input),
    getById: async (ctx, input) => getByIdImpl(spec, pkColumn, ctx, input),
    create: async (ctx, input) => createImpl(spec, ctx, input),
    update: async (ctx, input) => updateImpl(spec, pkColumn, ctx, input),
    delete: async (ctx, input) => deleteImpl(spec, pkColumn, ctx, input),
    duplicate: async (ctx, input) => duplicateImpl(spec, pkColumn, ctx, input),
  }
}

// ── list ─────────────────────────────────────────────────────────────────
//
// Composes visibility scope + search-by-spec-columns + sort-by-spec-columns.
// `input.filters` is intentionally ignored in Phase 1a — entity-specific
// filter predicates require either a v2 spec field or an L2 plugin override.
// No entity consumes the factory in Phase 1a, so this gap is deliberate.

async function listImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  ctx: AgentCtx,
  input: ListInput,
): Promise<PaginatedResult<Row<TTable>>> {
  const visibilityWhere = ctx.scope ?? undefined
  const searchWhere = spec.list?.searchColumns
    ? buildSearchWhere(input.search, [...spec.list.searchColumns])
    : undefined
  const where = and(visibilityWhere, searchWhere)

  const orderBy = buildOrderBy(
    input.sort,
    spec.list?.sortableColumns ?? {},
    resolveDefaultSort(spec),
  )

  const result = await paginate({
    query: () =>
      db
        .select()
        .from(spec.table as PgTable)
        .where(where)
        .orderBy(...orderBy)
        .limit(input.pagination.limit)
        .offset(input.pagination.offset),
    count: () => db.$count(spec.table as PgTable, where),
  })

  return result as PaginatedResult<Row<TTable>>
}

// ── getById ──────────────────────────────────────────────────────────────

async function getByIdImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: AgentCtx,
  input: { id: PkField<TTable> },
): Promise<Row<TTable> | undefined> {
  const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
  const [row] = await db
    .select()
    .from(spec.table as PgTable)
    .where(where)
    .limit(1)
  return row as Row<TTable> | undefined
}

// ── create ───────────────────────────────────────────────────────────────
//
// L0 validates with spec.schemas.insert and inserts. Visibility scope is NOT
// applied to create (you're inserting a new row that doesn't exist yet).
// Ownership-bounded create logic (e.g. "auto-assign owner = current user")
// is the business plugin's responsibility, not L0's.

async function createImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  _ctx: AgentCtx,
  input: Insert<TTable>,
): Promise<Row<TTable>> {
  const validated = spec.schemas.insert.parse(input) as Insert<TTable>
  const [row] = await db
    .insert(spec.table as PgTable)
    .values(validated)
    .returning()
  if (!row) {
    throw new Error('CreateFailed')
  }
  return row as Row<TTable>
}

// ── update ───────────────────────────────────────────────────────────────
//
// Validates with spec.schemas.update. Applies visibility scope so a
// non-omni caller can't update a row they can't see. JSONB merge per
// spec.update.jsonbMergeColumns is intentionally NOT implemented in Phase
// 1a — the existing per-entity updateProposal/updateCustomer paths cover
// the current consumers; the factory's update is a plain SET. Phase 1b
// adds JSONB-merge when Proposal needs it.

async function updateImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: AgentCtx,
  input: { id: PkField<TTable>, data: Update<TTable> },
): Promise<Row<TTable>> {
  const validated = spec.schemas.update.parse(input.data) as Update<TTable>
  const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
  const [row] = await db
    .update(spec.table as PgTable)
    .set(validated as Record<string, unknown>)
    .where(where)
    .returning()
  if (!row) {
    // Could be: row doesn't exist, or visibility scope excluded it. L1
    // maps NotFound to 404 — caller can't tell the two cases apart, which
    // is intentional (don't leak existence to unauthorized callers).
    throw new Error('NotFound')
  }
  return row as Row<TTable>
}

// ── delete ───────────────────────────────────────────────────────────────

async function deleteImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: AgentCtx,
  input: { id: PkField<TTable> },
): Promise<void> {
  const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
  const deleted = await db
    .delete(spec.table as PgTable)
    .where(where)
    .returning({ id: pkColumn })
  if (deleted.length === 0) {
    // Could be: row doesn't exist, or visibility scope excluded it. L1
    // maps NotFound to 404 — caller can't tell the two cases apart, which
    // is intentional (don't leak existence to unauthorized callers).
    throw new Error('NotFound')
  }
}

// ── duplicate ────────────────────────────────────────────────────────────
//
// Read the row by id (visibility-scoped), strip the primary key, insert as
// a new row. Returns the inserted row. Entities that need owner reassignment
// or other duplicate-time side effects wrap this in a business plugin.

async function duplicateImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: AgentCtx,
  input: { id: PkField<TTable> },
): Promise<Row<TTable>> {
  const source = await getByIdImpl(spec, pkColumn, ctx, input)
  if (!source) {
    throw new Error('NotFound')
  }
  const pkName = spec.primaryKey ?? 'id'
  const { [pkName]: _droppedPk, ...rest } = source as Record<string, unknown>
  const [row] = await db
    .insert(spec.table as PgTable)
    .values(rest as Record<string, unknown>)
    .returning()
  if (!row) {
    throw new Error('DuplicateFailed')
  }
  return row as Row<TTable>
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
      `[create-crud-handlers] Spec for '${spec.entityName}' references primary key `
      + `column '${pkName}' which is not on its table.`,
    )
  }
  return column
}

function resolveDefaultSort<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
) {
  const ds = spec.list?.defaultSort
  if (ds && spec.list?.sortableColumns?.[ds.column]) {
    const col = spec.list.sortableColumns[ds.column]
    return ds.dir === 'asc' ? asc(col) : desc(col)
  }
  // Fall back to primary-key DESC so newest-first is the universal default.
  return desc(getPkColumn(spec))
}
