import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { LeadSourceMonthlySpend } from '@/shared/db/schema/lead-source-monthly-spend'

import { and, eq, inArray } from 'drizzle-orm'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { leadSourceMonthlySpendTable } from '@/shared/db/schema/lead-source-monthly-spend'
import { leadSourceCrud } from '@/shared/entities/lead-sources/dal/server/crud'

export type LeadSourceSpendEntry = Pick<LeadSourceMonthlySpend, 'leadSourceId' | 'month' | 'amountCents'>

// System-level read: every source's spend, unscoped — callers are super-admin gated at the router.
export async function listLeadSourceSpend(months: readonly string[]): Promise<DalReturn<LeadSourceSpendEntry[]>> {
  return dalDbOperation(async () => {
    if (months.length === 0) {
      return []
    }
    return db
      .select({
        leadSourceId: leadSourceMonthlySpendTable.leadSourceId,
        month: leadSourceMonthlySpendTable.month,
        amountCents: leadSourceMonthlySpendTable.amountCents,
      })
      .from(leadSourceMonthlySpendTable)
      .where(inArray(leadSourceMonthlySpendTable.month, [...months]))
  })
}

/** Clearing a cell deletes its row: blank means "not entered", never $0. */
export async function setLeadSourceSpend(
  ctx: ScopedContext,
  entry: { leadSourceId: string, month: string, amountCents: number | null },
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    // The parent read runs under the caller's scope, so an unknown or out-of-scope source is a not-found, never a foreign-key failure.
    const source = dalVerifySuccess(await leadSourceCrud.getById(ctx, { id: entry.leadSourceId }))
    if (!source) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    if (entry.amountCents === null) {
      await db
        .delete(leadSourceMonthlySpendTable)
        .where(and(
          eq(leadSourceMonthlySpendTable.leadSourceId, entry.leadSourceId),
          eq(leadSourceMonthlySpendTable.month, entry.month),
        ))
      return
    }
    await db
      .insert(leadSourceMonthlySpendTable)
      .values({ leadSourceId: entry.leadSourceId, month: entry.month, amountCents: entry.amountCents })
      .onConflictDoUpdate({
        target: [leadSourceMonthlySpendTable.leadSourceId, leadSourceMonthlySpendTable.month],
        set: { amountCents: entry.amountCents },
      })
  })
}
