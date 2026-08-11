// Shared, table-parameterized media DAL ops that are NOT single-row CRUD slots —
// `list` and `reorder` — used across every media child (project, proposal). Both
// compose `ctx.scope` (the parent bridge), so an out-of-scope owner/row is
// invisible with NO per-row authz probe. This is where the reorder N+1 dies:
// N scoped UPDATEs in one transaction, replacing the old 2N (per-row authz GET +
// update). Rung by `mediaService`; never call `db` for media list/reorder elsewhere.

import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'

import { and, asc, eq } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'

/** Every media table shares `baseMediaColumns()` (→ `id`, `sortOrder`). */
interface MediaTable extends PgTable {
  id: PgColumn
  sortOrder: PgColumn
}

/** Scoped rows for one owner, ordered by `sortOrder`. Owner column is per-store (projectId | proposalId). */
export function listMediaByOwner(
  table: MediaTable,
  ownerColumn: PgColumn,
  ctx: ScopedContext,
  ownerId: string,
): Promise<DalReturn<Record<string, unknown>[]>> {
  return dalDbOperation(async () =>
    db
      .select()
      .from(table)
      .where(and(eq(ownerColumn, ownerId), ctx.scope ?? undefined))
      .orderBy(asc(table.sortOrder)) as Promise<Record<string, unknown>[]>,
  )
}

/**
 * Reorder in one scoped transaction: each row's `sortOrder` is set behind
 * `id = ? AND ctx.scope`, so out-of-scope ids simply match nothing (no probe,
 * no throw). Empty input is a no-op.
 */
export function reorderMedia(
  table: MediaTable,
  ctx: ScopedContext,
  updates: { id: number, sortOrder: number }[],
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    if (updates.length === 0) {
      return
    }
    await db.transaction(async (tx) => {
      for (const { id, sortOrder } of updates) {
        await tx.update(table).set({ sortOrder }).where(and(eq(table.id, id), ctx.scope ?? undefined))
      }
    })
  })
}
