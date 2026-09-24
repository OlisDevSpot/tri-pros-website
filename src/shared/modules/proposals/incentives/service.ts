// Proposal incentives service — the `proposal_incentives` child of the proposal
// aggregate.
//
//   ...proposalIncentiveCrud   the engine's five slots on the service itself. Every
//                              single-row write re-drives the parent's `final_tcp_cents`
//                              through the factory hooks (dal/server/crud.ts).
//   replace                    orchestration: read the parent through `proposalService.getById`
//                              (scoped — an invisible proposal is `not-found`), refuse while
//                              the proposal is on the lock ladder, atomically swap the GLOBAL
//                              rows via the one engine-inexpressible DAL write, re-drive the
//                              rollup, read back.
//   (no clone verb)            the source→target row copy is the DAL function
//                              `cloneGlobalIncentiveRows` (dal/server/mutations.ts),
//                              called from the proposals `duplicate.after` hook —
//                              a DAL module never imports a service.
//
// Cross-service references (own service, parent/root, siblings) are resolved AT
// CALL TIME inside method bodies — never at module top level. That is what makes
// the import cycle root → incentives → root safe (see ../service.ts).

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { ProposalIncentiveRow } from '@/shared/db/schema/proposal-incentives'
import type { Incentive } from '@/shared/modules/proposals/core/schemas'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { recomputeProposalFinancials } from '@/shared/modules/proposals/core/dal/server/mutations'
import { isProposalFrozen } from '@/shared/modules/proposals/core/lib/proposal-lock'
import { proposalIncentiveCrud } from '@/shared/modules/proposals/incentives/dal/server/crud'
import { replaceGlobalIncentiveRows } from '@/shared/modules/proposals/incentives/dal/server/mutations'
import { listProposalIncentives } from '@/shared/modules/proposals/incentives/dal/server/queries'
import { domainIncentivesToRows } from '@/shared/modules/proposals/incentives/lib/incentive-rows'
import { proposalService } from '@/shared/modules/proposals/service'

export const proposalIncentivesService = {
  ...proposalIncentiveCrud,

  /**
   * Replace-all upsert of GLOBAL incentives (funding-form save path). Lock gate:
   * refuses while the proposal is anywhere on the lock ladder (draft envelope
   * exists, contract in flight, or terminal) — the sanctioned edit path
   * discards/recalls the envelope first (#264).
   */
  async replace(ctx: ScopedContext, input: { proposalId: string, incentives: Incentive[] }): Promise<DalReturn<ProposalIncentiveRow[]>> {
    return dalDbOperation(async () => {
      const proposal = dalVerifySuccess(await proposalService.getById(ctx, { id: input.proposalId }))
      if (!proposal) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (isProposalFrozen(proposal)) {
        throw new ThrowableDalError({ type: 'precondition-failed', reason: 'proposal_frozen' })
      }

      dalVerifySuccess(await replaceGlobalIncentiveRows(input.proposalId, domainIncentivesToRows(input.proposalId, input.incentives)))
      dalVerifySuccess(await recomputeProposalFinancials(input.proposalId))
      return dalVerifySuccess(await listProposalIncentives(input.proposalId))
    })
  },

} as const

export type ProposalIncentivesService = typeof proposalIncentivesService
