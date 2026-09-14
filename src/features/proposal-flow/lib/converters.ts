import type { ProposalFormSchema } from '../schemas/form-schema'
import type { ProposalWithCustomer } from '@/shared/modules/proposals/core/dal/server/queries'

import { toFundingInputs } from '@/shared/modules/proposals/core/lib/funding-columns'

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
