import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { AnyServerSpec, DalReturn, ScopedContext } from '../types'
import type { Insert, Row } from '@/shared/db/types'
import type { ServerSpec } from '@/shared/domains/permissions/specs'

import { db } from '@/shared/db'

import { ThrowableDalError } from '../types'
import { dalDbOperation } from './helpers'
import { columnKeyOf, reachFor, rootRowFor } from './permissions/core'
import { isCompiled } from './scope'

/**
 * The write slot of a one-to-one part (its primary key is its foreign key): the first write inserts,
 * every write after updates the same row. The actor must hold the parent's `update` on the part and
 * on each column written, tested on the parent row, which is loaded through the parent's read reach.
 */
export async function upsertOneToOne<TSpec extends ServerSpec & { parent: { field: string } }>(
  ctx: ScopedContext,
  spec: TSpec,
  parentId: string,
  set: Record<string, unknown>,
): Promise<DalReturn<Row<TSpec['table']>>> {
  return dalDbOperation(async () => {
    if (!isCompiled(spec)) {
      throw new Error(`[upsert-one-to-one] ${spec.entityName} is not compiled: its family converts it first`)
    }
    const validated = spec.schemas.update.parse(set) as Record<string, unknown>
    // Undefined = untouched (never overwrite with `undefined`); explicit `null` is a legitimate clear and passes through.
    const filtered = Object.fromEntries(Object.entries(validated).filter(([, value]) => value !== undefined))
    const columns = Object.keys(filtered)
    if (columns.length === 0) {
      throw new ThrowableDalError({
        type: 'precondition-failed',
        reason: 'upsertOneToOne: no fields to write (patch was empty or all-undefined)',
      })
    }

    const erased: AnyServerSpec = spec
    const fkKey = columnKeyOf(erased.table as PgTable, spec.parent.fk as PgColumn)
    const parentRow = await rootRowFor(ctx, erased, { [fkKey]: parentId })
    if (!reachFor(ctx, 'update', erased).test(parentRow)) {
      throw new ThrowableDalError({ type: 'forbidden', field: erased.entityName })
    }
    for (const column of columns) {
      if (!reachFor(ctx, 'update', erased, [column]).test(parentRow)) {
        throw new ThrowableDalError({ type: 'forbidden', field: `${erased.entityName}.${column}` })
      }
    }

    const [row] = await (ctx.tx ?? db)
      .insert(erased.table as PgTable)
      .values({ [fkKey]: parentId, ...filtered } as Insert<TSpec['table']>)
      .onConflictDoUpdate({ target: spec.parent.fk as PgColumn, set: filtered })
      .returning()
    return row as Row<TSpec['table']>
  })
}
