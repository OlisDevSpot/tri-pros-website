// The two media ops that are not single-row CRUD slots, shared by every media child. Both take the
// caller's row filter, so an unreachable owner or row matches nothing with no per-row probe.

import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { DalReturn } from '@/shared/dal/server/types'

import { and, asc, eq } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'

/** Every media table shares `baseMediaColumns()` (→ `id`, `sortOrder`). */
interface MediaTable extends PgTable {
  id: PgColumn
  sortOrder: PgColumn
}

/** Rows for one owner, ordered by `sortOrder`, narrowed by the caller's row filter. */
export function listMediaByOwner(table: MediaTable, ownerColumn: PgColumn, where: SQL | undefined, ownerId: string): Promise<DalReturn<Record<string, unknown>[]>> {
  return dalDbOperation(async () =>
    db.select().from(table).where(and(eq(ownerColumn, ownerId), where)).orderBy(asc(table.sortOrder)) as Promise<Record<string, unknown>[]>)
}

/** Reorder in one transaction: a row outside `where` matches nothing (no probe, no throw). Empty input is a no-op. */
export function reorderMedia(table: MediaTable, where: SQL | undefined, updates: { id: number, sortOrder: number }[]): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    if (updates.length === 0) {
      return
    }
    await db.transaction(async (tx) => {
      for (const { id, sortOrder } of updates) {
        await tx.update(table).set({ sortOrder }).where(and(eq(table.id, id), where))
      }
    })
  })
}
