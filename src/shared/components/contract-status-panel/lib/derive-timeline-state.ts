import type { AgreementStepKey } from '../constants/agreement-timeline'
import type { ZohoContractStatus } from '@/shared/services/zoho-sign/types'

export type StepState = 'completed' | 'active' | 'upcoming'

export interface TimelineStepState {
  key: AgreementStepKey
  state: StepState
}

/**
 * Maps Zoho contract status + signer data to the 4-step agreement timeline.
 *
 * Logic:
 * - Step 1 (Proposal Created): always completed (proposal exists if this component renders)
 * - Step 2 (Agreement Drafted): completed if contractStatus exists
 * - Step 3 (Contractor Accepted): completed if contractor signer status === 'SIGNED'
 * - Step 4 (Homeowner Accepted): completed if homeowner signer status === 'SIGNED'
 *
 * The first non-completed step is marked 'active', everything after is 'upcoming'.
 */
export function deriveTimelineState(
  contractStatus: (ZohoContractStatus & { contractSentAt: string | null }) | null,
): TimelineStepState[] {
  const contractorSigner = contractStatus?.signerStatuses.find(s => s.role === 'Contractor')
  const homeownerSigner = contractStatus?.signerStatuses.find(s => s.role === 'Homeowner')

  const isTerminal = contractStatus?.requestStatus === 'declined'
    || contractStatus?.requestStatus === 'recalled'
    || contractStatus?.requestStatus === 'expired'

  const completions: Record<AgreementStepKey, boolean> = {
    'proposal-created': true,
    'agreement-drafted': contractStatus !== null && !isTerminal,
    'contractor-accepted': contractorSigner?.status === 'SIGNED' && !isTerminal,
    'homeowner-accepted': homeownerSigner?.status === 'SIGNED' && !isTerminal,
  }

  const keys: AgreementStepKey[] = [
    'proposal-created',
    'agreement-drafted',
    'contractor-accepted',
    'homeowner-accepted',
  ]

  let foundActive = false
  return keys.map((key) => {
    if (completions[key]) {
      return { key, state: 'completed' as const }
    }
    if (!foundActive) {
      foundActive = true
      return { key, state: 'active' as const }
    }
    return { key, state: 'upcoming' as const }
  })
}
