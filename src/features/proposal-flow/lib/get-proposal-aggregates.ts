import type { ProposalFormSchema } from '../schemas/form-schema'
import type { InsertProposalSchema } from '@/shared/db/schema'

import { computeFinalTcp, computeTotalDiscounts, computeTotalSectionPrices } from '@/shared/entities/proposals/lib/financials'

export function getProposalAggregates(proposal: ProposalFormSchema | InsertProposalSchema) {
  const { pricingMode } = 'meta' in proposal ? proposal.meta : proposal.formMetaJSON
  const fundingJSON = 'meta' in proposal ? proposal.funding : proposal.fundingJSON
  const projectJSON = 'meta' in proposal ? proposal.project : proposal.projectJSON

  const totalSOWPriceBreakdown = pricingMode === 'breakdown'
    ? computeTotalSectionPrices(projectJSON.data.sow)
    : undefined

  return {
    totalSOWPriceBreakdown,
    totalProjectDiscounts: computeTotalDiscounts(fundingJSON.data),
    finalTcp: computeFinalTcp({ funding: fundingJSON.data, sow: projectJSON.data.sow }),
  }
}
