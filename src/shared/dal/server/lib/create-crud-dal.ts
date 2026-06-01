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
} from '../types'
import type { Insert, Row, Update } from '@/shared/db/types'

import { and, eq, sql } from 'drizzle-orm'

import { db } from '@/shared/db'

import { ThrowableDalError } from '../types'
import { dalDbOperation } from './helpers'

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
  ctx: ScopedContext,
  input: Insert<TTable>,
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    const enriched = spec.hooks?.create?.before
      ? await spec.hooks.create.before(input, ctx)
      : input
    const validated = spec.schemas.insert.parse(enriched) as Insert<TTable>
    const [row] = await db
      .insert(spec.table as PgTable)
      .values(validated)
      .returning()
    if (!row) {
      throw new ThrowableDalError({ type: 'create-failed' })
    }

    if (spec.hooks?.create?.after) {
      await spec.hooks.create.after(row as Row<TTable>, ctx)
    }

    return row as Row<TTable>
  })
}

// ── update ───────────────────────────────────────────────────────────────

/**
 * Build the Drizzle `.set()` payload for an update, applying JSONB deep-merge
 * semantics for any column listed in `spec.update.jsonbMergeColumns`.
 *
 * Behavior:
 * - If `spec.update.jsonbMergeColumns` is absent/empty → return `validated`
 *   unchanged (no-op for entities that haven't opted in).
 * - Skip keys whose value is `undefined` (partial updates must not clobber
 *   existing JSONB content when the caller didn't pass that key).
 * - For each opted-in column whose value is a non-null object, emit
 *   `COALESCE(<col>, '{}'::jsonb) || <new>::jsonb` so existing keys
 *   survive and only the provided keys are overwritten.
 * - All other values pass through unchanged.
 *
 * Note on column lookup: Drizzle's `PgColumn.name` is the DB-side name
 * (snake_case). `validated` is keyed by the TS-side Drizzle property name
 * (camelCase). We resolve TS-side keys by reference identity against
 * `spec.table`.
 *
 * see ../../../entities/proposals/DOCS.md#jsonb-merge-on-update
 */
function buildUpdateSet<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  validated: Record<string, unknown>,
): Record<string, unknown> {
  const mergeCols = spec.update?.jsonbMergeColumns
  if (!mergeCols || mergeCols.length === 0) {
    return validated
  }

  // Map TS-side property name → PgColumn for opted-in merge columns.
  // We iterate the table's column entries once and match by reference identity.
  const mergeByKey = new Map<string, PgColumn>()
  const mergeColSet = new Set<PgColumn>(mergeCols)
  const tableCols = spec.table as unknown as Record<string, PgColumn>
  for (const [tsKey, col] of Object.entries(tableCols)) {
    if (mergeColSet.has(col)) {
      mergeByKey.set(tsKey, col)
    }
  }

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(validated)) {
    if (value === undefined) {
      continue
    }
    if (mergeByKey.has(key)) {
      if (value === null) {
        // null is legitimate — caller is intentionally clearing the column.
        out[key] = value
      }
      else if (typeof value === 'object' && !Array.isArray(value)) {
        const col = mergeByKey.get(key)!
        out[key] = sql`COALESCE(${col}, '{}'::jsonb) || ${JSON.stringify(value)}::jsonb`
      }
      else {
        // Primitives and arrays would silently fall through to plain `.set()`,
        // violating the merge-not-replace contract for opted-in columns.
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: `[create-crud-dal] jsonbMergeColumns entry '${key}' for '${spec.entityName}' `
            + `received non-object value (${Array.isArray(value) ? 'array' : typeof value}); `
            + `merge requires a plain object, or null to clear.`,
        })
      }
      continue
    }
    out[key] = value
  }
  return out
}

async function updateImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number, data: Update<TTable> },
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    const enrichedData = spec.hooks?.update?.before
      ? await spec.hooks.update.before(input.data, ctx)
      : input.data

    // Fetch previousRow only when after hook needs it (one extra SELECT)
    let previousRow: Row<TTable> | undefined
    if (spec.hooks?.update?.after) {
      const prev = await getByIdImpl(spec, pkColumn, ctx, { id: input.id })
      if (prev.success) {
        previousRow = prev.data as Row<TTable> | undefined
      }
    }

    const validated = spec.schemas.update.parse(enrichedData) as Update<TTable>
    const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
    const [row] = await db
      .update(spec.table as PgTable)
      .set(buildUpdateSet(spec, validated as Record<string, unknown>))
      .where(where)
      .returning()
    if (!row) {
      throw new ThrowableDalError({ type: 'not-found' })
    }

    if (spec.hooks?.update?.after && previousRow) {
      await spec.hooks.update.after(row as Row<TTable>, ctx, {
        previousRow,
        input: input.data,
      })
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
    if (spec.hooks?.delete?.before) {
      await spec.hooks.delete.before(input.id, ctx)
    }

    const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)
    const deleted = await db
      .delete(spec.table as PgTable)
      .where(where)
      .returning({ id: pkColumn })
    if (deleted.length === 0) {
      throw new ThrowableDalError({ type: 'not-found' })
    }

    if (spec.hooks?.delete?.after) {
      await spec.hooks.delete.after(input.id, ctx)
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
  const excludeSet = new Set<string>([
    pkName,
    ...(spec.duplicate?.exclude ?? []),
  ])
  const base = Object.fromEntries(
    Object.entries(source as Record<string, unknown>)
      .filter(([key]) => !excludeSet.has(key))
      .map(([key, val]) => [key, val === null ? undefined : val]),
  )

  // 3. Apply overrides
  const overrides = spec.duplicate?.overrides?.(source, ctx) ?? {}
  const insertData = { ...base, ...overrides } as Insert<TTable>

  // 4. Route through createImpl — create.before + create.after fire automatically
  return createImpl(spec, ctx, insertData)
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
