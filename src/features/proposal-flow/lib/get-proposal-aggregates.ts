import type { ProposalFormSchema } from '../schemas/form-schema'

import { computeFinalTcp, computeTotalDiscounts, computeTotalSectionPrices } from '@/shared/entities/proposals/lib/financials'

/**
 * Live form-state aggregates. Form values are the ONLY input shape — server
 * rows go through the financials façade, not this helper.
 */
export function getProposalAggregates(proposal: ProposalFormSchema) {
  const totalSOWPriceBreakdown = proposal.priceDisplayMode === 'breakdown'
    ? computeTotalSectionPrices(proposal.project.data.sow)
    : undefined

  return {
    totalSOWPriceBreakdown,
    totalProjectDiscounts: computeTotalDiscounts(proposal.funding),
    finalTcp: computeFinalTcp({ funding: proposal.funding, sow: proposal.project.data.sow }),
  }
}
