// Proposal entity DAL mutations. Business-specific operations beyond CRUD.
// DAL conventions: docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { InsertProposalView, ProposalView } from '@/shared/db/schema/proposal-views'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { proposalViews } from '@/shared/db/schema/proposal-views'

// ── recordProposalView ─────────────────────────────────────────────────

/** Records a proposal view event. Called from the public recordView procedure on homeowner open. */
export async function recordProposalView(
  input: InsertProposalView,
): Promise<DalReturn<ProposalView>> {
  return dalDbOperation(async () => {
    const [view] = await db.insert(proposalViews).values(input).returning()
    if (!view) {
      throw new ThrowableDalError({ type: 'create-failed' })
    }
    return view
  })
}
