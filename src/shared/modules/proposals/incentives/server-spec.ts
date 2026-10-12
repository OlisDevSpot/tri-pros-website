import { defineSubEntitySpec } from '@/shared/dal/server/lib/define-spec'
import {
  insertProposalIncentiveSchema,
  proposalIncentives,
  selectProposalIncentiveSchema,
} from '@/shared/db/schema/proposal-incentives'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { PROPOSAL_INCENTIVE } from '@/shared/modules/proposals/incentives/lib/constants'

const updateProposalIncentiveSchema = insertProposalIncentiveSchema.partial()

/** Concrete schemas for tRPC input inference (spec carries type-erased copies). */
export const proposalIncentiveSchemas = {
  insert: insertProposalIncentiveSchema,
  update: updateProposalIncentiveSchema,
}

/**
 * `proposal_incentives` as a first-class CHILD entity. No independent ownership:
 * it is the field `incentives` of `Proposal`, read and written through the
 * proposal's rules on that field. Lifecycle hooks (the
 * parent rollup re-drive) live in the createCrudDal config factory at
 * dal/server/crud.ts — never here.
 */
export const proposalIncentiveServerSpec = defineSubEntitySpec({
  entityName: PROPOSAL_INCENTIVE,
  parent: { spec: proposalServerSpec, fk: proposalIncentives.proposalId, field: 'incentives' },
  table: proposalIncentives,
  schemas: {
    insert: insertProposalIncentiveSchema,
    update: updateProposalIncentiveSchema,
    select: selectProposalIncentiveSchema,
  },
})
