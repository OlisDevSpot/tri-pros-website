import type { ProposalContext } from './types'
import type { EnvelopeScenario } from '@/shared/constants/enums'
import type { ProposalWithCustomer } from '@/shared/dal/server/proposals/api'
import { isSeniorByAge } from '@/shared/entities/customers/lib/customer-predicates'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { sowToPlaintext } from '@/shared/lib/tiptap-to-text'
import { isLongSow } from '../lib/is-long-sow'

/**
 * Pure snapshot for predicates + field sources. `ageOverride` only
 * feeds `isSenior` (rules-only) — field sources still resolve `ho-age`
 * from the saved customer record, so an override never affects values
 * shipped to Zoho.
 */
export function buildProposalContext(
  proposal: ProposalWithCustomer,
  options: { ageOverride?: number } = {},
): ProposalContext {
  const scenario: EnvelopeScenario = proposal.meetingProjectId !== null ? 'upsell' : 'initial'
  const sowText = sowToPlaintext(proposal.projectJSON.data.sow ?? [])
  const ageForSeniorCheck = options.ageOverride ?? proposal.customer?.customerAge
  const originalContractDate = proposal.projectFirstContractSentAt
    ? new Date(proposal.projectFirstContractSentAt)
    : null
  return {
    proposal,
    scenario,
    isSenior: isSeniorByAge(ageForSeniorCheck),
    isLongSow: isLongSow(sowText),
    finalTcp: computeFinalTcp(proposal.fundingJSON.data),
    sowText,
    originalContractDate,
  }
}
