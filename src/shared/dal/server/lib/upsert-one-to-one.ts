// ─── upsertOneToOne (1:1 child-table lazy upsert) ──────────────────────────
// Generic write for 1:1 child tables (PK-as-FK, e.g. `customer_profiles`,
// house precedent `voip_campaign_contacts`). Row-exists carries business
// meaning ("discovery data has been collected") — first write inserts,
// every write after updates the same row.
//
// Not wired into createCrudDal — no entity/children registry exists yet.
// Business-DAL mutations call this directly; promote to a spec-level
// `children` registry only after the rule-of-three (Addendum B).
// see docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md §10

import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { DalReturn } from '../types'
import type { Insert, Row } from '@/shared/db/types'

import { db } from '@/shared/db'
import { ThrowableDalError } from '../types'
import { dalDbOperation } from './helpers'

export async function upsertOneToOne<TTable extends PgTable>(
  table: TTable,
  fkColumn: PgColumn,
  parentId: string,
  set: Record<string, unknown>,
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    // Undefined = untouched (never overwrite with `undefined`); explicit
    // `null` is a legitimate clear and passes through.
    const filtered = Object.fromEntries(
      Object.entries(set).filter(([, value]) => value !== undefined),
    )
    if (Object.keys(filtered).length === 0) {
      throw new ThrowableDalError({
        type: 'precondition-failed',
        reason: 'upsertOneToOne: no fields to write (patch was empty or all-undefined)',
      })
    }

    // PgColumn.name is the DB-side snake_case name; `.values()` needs the
    // TS-side (camelCase) property key — resolve it by reference identity
    // against the table's own column map.
    const tableCols = table as unknown as Record<string, PgColumn>
    const fkKey = Object.entries(tableCols).find(([, col]) => col === fkColumn)?.[0]
    if (!fkKey) {
      throw new ThrowableDalError({
        type: 'precondition-failed',
        reason: 'upsertOneToOne: fkColumn is not a column on table',
      })
    }

    const [row] = await db
      .insert(table as PgTable)
      .values({ [fkKey]: parentId, ...filtered } as Insert<TTable>)
      .onConflictDoUpdate({ target: fkColumn, set: filtered })
      .returning()
    return row as Row<TTable>
  })
}
