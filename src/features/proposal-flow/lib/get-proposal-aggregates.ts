import type { ProposalFormSchema } from '../schemas/form-schema'
import type { InsertProposalSchema } from '@/shared/db/schema'

import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'

export function getProposalAggregates(proposal: ProposalFormSchema | InsertProposalSchema) {
  const { pricingMode } = 'meta' in proposal ? proposal.meta : proposal.formMetaJSON
  const fundingJSON = 'meta' in proposal ? proposal.funding : proposal.fundingJSON
  const projectJSON = 'meta' in proposal ? proposal.project : proposal.projectJSON

  const totalProjectDiscounts = fundingJSON.data.incentives.reduce((acc, cur) => {
    if (cur.type === 'discount') {
      return acc + cur.amount
    }

    return acc
  }, 0)

  const totalSOWPriceBreakdown = pricingMode === 'breakdown' ? projectJSON.data.sow.reduce((sum, s) => sum + (s.price ?? 0), 0) : undefined

  return {
    totalSOWPriceBreakdown,
    totalProjectDiscounts,
    finalTcp: computeFinalTcp(fundingJSON.data),
  }
}
