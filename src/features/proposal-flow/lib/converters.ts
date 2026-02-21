import type { ProposalFormSchema } from '../schemas/form-schema'
import type { Proposal } from '@/shared/db/schema'

export function proposalToFormValues(proposal: Proposal): ProposalFormSchema {
  return {
    funding: {
      cashInDeal: proposal.cashInDeal,
      depositAmount: proposal.depositAmount,
      tcp: proposal.tcp,
    },
    homeowner: {
      name: proposal.name,
      phoneNum: proposal.phoneNum,
      email: proposal.email,
      customerAge: proposal.customerAge,
    },
    project: {
      label: proposal.label,
      address: proposal.address,
      city: proposal.city,
      state: proposal.state,
      zipCode: proposal.zipCode,
      projectType: proposal.projectType,
      timeAllocated: proposal.timeAllocated,
      sow: proposal.sow || [],
      agreementNotes: proposal.agreementNotes,
    },
  }
}
