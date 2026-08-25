// Shared, table-parameterized media DAL ops that are NOT single-row CRUD slots —
// `list` and `reorder` — used across every media child (project, proposal). Both
// compose `ctx.scope` (the parent bridge), so an out-of-scope owner/row is
// invisible with NO per-row authz probe. This is where the reorder N+1 dies:
// N scoped UPDATEs in one transaction, replacing the old 2N (per-row authz GET +
// update). Rung by `mediaService`; never call `db` for media list/reorder elsewhere.

import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { MediaPhase } from '@/shared/constants/enums/media'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'

import { and, asc, eq, inArray } from 'drizzle-orm'

import { dalDbOperation, requireResolvedScope } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
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
      .where(and(eq(ownerColumn, ownerId), requireResolvedScope(ctx.scope)))
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
        await tx.update(table).set({ sortOrder }).where(and(eq(table.id, id), requireResolvedScope(ctx.scope)))
      }
    })
  })
}

/** Media table that carries a `phase` column (project media). */
interface PhasedMediaTable extends PgTable {
  id: PgColumn
  phase: PgColumn
}

/** Media table that carries an `isHeroImage` column (project media). */
interface HeroMediaTable extends PgTable {
  id: PgColumn
  isHeroImage: PgColumn
}

/**
 * Set `phase` on the given rows in ONE scoped UPDATE. `id IN (ids) AND ctx.scope`
 * means out-of-scope ids simply match nothing — no per-row authz probe, no throw.
 * Empty input is a no-op. Replaces the router's old per-id unscoped loop.
 */
export function moveMediaPhase(
  table: PhasedMediaTable,
  ctx: ScopedContext,
  ids: number[],
  phase: MediaPhase,
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    if (ids.length === 0) {
      return
    }
    await db.update(table).set({ phase }).where(and(inArray(table.id, ids), requireResolvedScope(ctx.scope)))
  })
}

/**
 * Toggle a row's `isHeroImage`. A scoped `getById` authorizes the caller and
 * yields the owner id; when promoting to hero, the project-wide unset is bounded
 * to that authorized owner (precursor-proven visible), then the target row is set
 * behind `id = ? AND ctx.scope`. An invisible/missing row is a not-found — no
 * existence leak, no partial unset.
 */
export function setHeroImage(
  table: HeroMediaTable,
  ownerColumn: PgColumn,
  ctx: ScopedContext,
  id: number,
  isHero: boolean,
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    const [row] = await db
      .select({ owner: ownerColumn })
      .from(table)
      .where(and(eq(table.id, id), requireResolvedScope(ctx.scope)))
      .limit(1)
    if (!row) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    await db.transaction(async (tx) => {
      if (isHero) {
        await tx.update(table).set({ isHeroImage: false }).where(eq(ownerColumn, row.owner))
      }
      await tx.update(table).set({ isHeroImage: isHero }).where(and(eq(table.id, id), requireResolvedScope(ctx.scope)))
    })
  })
}
