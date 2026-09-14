import type { EntityServerSpec } from '@/shared/dal/server/types'

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
 * `proposal_incentives` as a first-class CHILD entity. No independent ownership,
 * so no own `visibility`: its effective scope is parent-derived —
 * `proposalId IN (SELECT proposals.id WHERE <proposal effective scope>)` —
 * folded into `ctx.scope` by whichever procedure resolves this spec.
 * `caslSubject` reuses the parent `Proposal` subject. Lifecycle hooks (the
 * parent rollup re-drive) live in the createCrudDal config factory at
 * dal/server/crud.ts — never here.
 */
export const proposalIncentiveServerSpec = {
  entityName: PROPOSAL_INCENTIVE,
  caslSubject: proposalServerSpec.caslSubject,
  parent: { spec: proposalServerSpec, fk: proposalIncentives.proposalId },
  table: proposalIncentives,
  schemas: {
    insert: insertProposalIncentiveSchema,
    update: updateProposalIncentiveSchema,
    select: selectProposalIncentiveSchema,
  },
} satisfies EntityServerSpec<typeof proposalIncentives>
