import type { ZohoRequestStatus } from '@/shared/services/providers/zoho-sign/types'

export type NextStepState = 'done' | 'current' | 'upcoming'
export type NextStepsAction = 'request' | 'requested' | 'prepared' | 'review' | 'sign' | 'declined' | 'kickoff'

interface Input {
  requested: boolean
  requestStatus: ZohoRequestStatus | null
  contractorSigned: boolean
  signed: boolean
}

// Declined is permanent: a declined contract is renegotiated on a new proposal, never re-requested.
export function deriveNextSteps({ requested, requestStatus, contractorSigned, signed }: Input): { states: NextStepState[], action: NextStepsAction } {
  if (signed || requestStatus === 'completed') {
    return { states: ['done', 'done', 'done', 'current'], action: 'kickoff' }
  }
  if (requestStatus === 'declined') {
    return { states: ['done', 'upcoming', 'upcoming', 'upcoming'], action: 'declined' }
  }
  if (requestStatus === 'inprogress') {
    // The signing email goes out only after the contractor signs.
    return contractorSigned
      ? { states: ['done', 'done', 'current', 'upcoming'], action: 'sign' }
      : { states: ['done', 'current', 'upcoming', 'upcoming'], action: 'review' }
  }
  if (requestStatus === 'draft') {
    return { states: ['done', 'done', 'upcoming', 'upcoming'], action: 'prepared' }
  }
  if (requested) {
    return { states: ['done', 'done', 'upcoming', 'upcoming'], action: 'requested' }
  }
  return { states: ['done', 'current', 'upcoming', 'upcoming'], action: 'request' }
}
