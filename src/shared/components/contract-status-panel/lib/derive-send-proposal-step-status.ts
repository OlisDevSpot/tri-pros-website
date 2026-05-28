import type { SendProposalStage, SendProposalStep } from '@/shared/entities/proposals/hooks/use-send-proposal-with-draft'
import { SEND_PROPOSAL_STEPS } from '../constants/send-proposal-steps'

export type SendProposalStepStatus = 'pending' | 'active' | 'done' | 'error'

export function deriveSendProposalStepStatus(
  stepKey: SendProposalStep,
  stage: SendProposalStage,
  failedStep: SendProposalStep | null,
): SendProposalStepStatus {
  if (stage === 'error' && failedStep) {
    if (stepKey === failedStep) {
      return 'error'
    }
    // Any step before the failed one must have completed.
    const failedIndex = SEND_PROPOSAL_STEPS.findIndex(s => s.key === failedStep)
    const myIndex = SEND_PROPOSAL_STEPS.findIndex(s => s.key === stepKey)
    return myIndex < failedIndex ? 'done' : 'pending'
  }
  if (stage === 'creating-draft') {
    return stepKey === 'creating-draft' ? 'active' : 'pending'
  }
  if (stage === 'sending-email') {
    return stepKey === 'creating-draft' ? 'done' : 'active'
  }
  return 'pending'
}
