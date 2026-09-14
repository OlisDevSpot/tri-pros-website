// proposal_views DAL — mutations. Records homeowner proposal-view events.
// Child of proposals; auth is enforced at the router (token path). Until S3b's
// subEntitySpec, this is a plain unscoped insert like the ad-hoc pattern.
// DAL conventions: docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { InsertProposalView, ProposalView } from '@/shared/db/schema/proposal-views'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { proposalViews } from '@/shared/db/schema/proposal-views'

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
