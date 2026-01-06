import { ROOTS } from '@/shared/config/roots'

interface EmailTemplateProps {
  proposalId: string
  token: string
}

export function ProposalEmail({ proposalId, token }: EmailTemplateProps) {
  return (
    <div>
      <h1>
        Your Proposal From Tri Pros Remodeling is ready!
      </h1>
      <a href={`${ROOTS.proposalFlow({ absolute: true, isProduction: true })}/proposal/${proposalId}?token=${token}`}>Click here to view your proposal</a>
    </div>
  )
}
