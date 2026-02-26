import type { ProposalFormSchema } from '../schemas/form-schema'
import type { Proposal } from '@/shared/db/schema'

export function proposalToFormValues(proposal: Proposal): ProposalFormSchema {
  const data: ProposalFormSchema = {
    homeowner: proposal.homeownerJSON,
    project: proposal.projectJSON,
    funding: proposal.fundingJSON,
  }

  return data
}
