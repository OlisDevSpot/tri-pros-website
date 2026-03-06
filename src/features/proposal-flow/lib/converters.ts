import type { ProposalFormSchema } from '../schemas/form-schema'
import type { InsertProposalSchema, Proposal } from '@/shared/db/schema'

export function proposalToFormValues(proposal: Proposal): ProposalFormSchema {
  const data: ProposalFormSchema = {
    meta: proposal.formMetaJSON,
    homeowner: proposal.homeownerJSON,
    project: proposal.projectJSON,
    funding: proposal.fundingJSON,
  }

  return data
}

export function formValuesToProposal(formValues: ProposalFormSchema): InsertProposalSchema {
  const data: InsertProposalSchema = {
    ownerId: '',
    label: formValues.project.data.label,
    formMetaJSON: formValues.meta,
    homeownerJSON: formValues.homeowner,
    projectJSON: formValues.project,
    fundingJSON: formValues.funding,
  }

  return data
}
