import type { ProposalFormSchema } from '../schemas/form-schema'
import type { InsertProposalSchema } from '@/shared/db/schema'

import { computeFinalTcp, computeTotalDiscounts } from '@/shared/entities/proposals/lib/compute-final-tcp'

export function getProposalAggregates(proposal: ProposalFormSchema | InsertProposalSchema) {
  const { pricingMode } = 'meta' in proposal ? proposal.meta : proposal.formMetaJSON
  const fundingJSON = 'meta' in proposal ? proposal.funding : proposal.fundingJSON
  const projectJSON = 'meta' in proposal ? proposal.project : proposal.projectJSON

  const totalSOWPriceBreakdown = pricingMode === 'breakdown'
    ? projectJSON.data.sow.reduce((sum, s) => sum + (s.financials.sectionPrice ?? 0), 0)
    : undefined

  return {
    totalSOWPriceBreakdown,
    totalProjectDiscounts: computeTotalDiscounts(fundingJSON.data),
    finalTcp: computeFinalTcp(fundingJSON.data),
  }
}
