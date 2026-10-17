import type { ZohoRequestStatus } from '@/shared/services/providers/zoho-sign/types'

export type NextStepState = 'done' | 'current' | 'upcoming'

export function deriveNextSteps({ requested, requestStatus, signed }: { requested: boolean, requestStatus: ZohoRequestStatus | null, signed: boolean }): { states: NextStepState[], action: 'request' | 'requested' | 'sign' | 'kickoff' } {
  if (signed) {
    return { states: ['done', 'done', 'done', 'current'], action: 'kickoff' }
  }
  if (requestStatus === 'inprogress') {
    return { states: ['done', 'done', 'current', 'upcoming'], action: 'sign' }
  }
  if (requested) {
    return { states: ['done', 'done', 'upcoming', 'upcoming'], action: 'requested' }
  }
  return { states: ['done', 'current', 'upcoming', 'upcoming'], action: 'request' }
}
