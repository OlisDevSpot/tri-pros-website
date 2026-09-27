import type { ProposalKind } from '@/shared/constants/enums/proposals'
import type { DalReturn } from '@/shared/dal/server/types'

import { eq } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema/proposals'
import { SALE_STATUS } from '@/shared/modules/proposals/core/lib/sale'

export interface SaleFact {
  id: string
  meetingId: string | null
  kind: ProposalKind
  approvedAt: string | null
  finalTcpCents: number | null
}

// System-level read: every sale, unscoped — analytics callers are super-admin gated at the router.
export async function listSaleFacts(): Promise<DalReturn<SaleFact[]>> {
  return dalDbOperation(async () => {
    const rows = await db
      .select({
        id: proposals.id,
        meetingId: proposals.meetingId,
        kind: proposals.kind,
        approvedAt: proposals.approvedAt,
        finalTcpCents: proposals.finalTcpCents,
      })
      .from(proposals)
      .where(eq(proposals.status, SALE_STATUS))
    // Postgres returns '2026-07-01 17:00:00+00'; downstream compares ISO strings.
    return rows.map(row => ({ ...row, approvedAt: row.approvedAt === null ? null : new Date(row.approvedAt).toISOString() }))
  })
}
