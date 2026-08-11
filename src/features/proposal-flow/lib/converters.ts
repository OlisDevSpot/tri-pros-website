import type { ProposalFormSchema } from '../schemas/form-schema'
import type { ProposalWithCustomer } from '@/shared/entities/proposals/dal/server/queries'

import { toFundingInputs } from '@/shared/entities/proposals/lib/funding-columns'

/**
 * Server row → RHF form state. Funding comes from the cents columns +
 * incentive rows via `toFundingInputs` — never from the frozen blob.
 */
export function proposalToFormValues(proposal: ProposalWithCustomer): ProposalFormSchema {
  return {
    priceDisplayMode: proposal.priceDisplayMode,
    project: proposal.projectJSON,
    funding: toFundingInputs(proposal),
  }
}
