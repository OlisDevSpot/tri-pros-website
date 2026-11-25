import type { ProposalLockSignals } from '@/shared/modules/proposals/core/lib/proposal-lock'
import { isProposalFrozen } from '@/shared/modules/proposals/core/lib/proposal-lock'

// A send stamps status 'sent', so it would reopen an approved or declined proposal; a frozen one is in its agreement.
export function canSendProposal(proposal: ProposalLockSignals): boolean {
  return (proposal.status === 'draft' || proposal.status === 'sent') && !isProposalFrozen(proposal)
}
