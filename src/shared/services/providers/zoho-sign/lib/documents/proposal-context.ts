import type { ProposalContext } from './types'
import type { ProposalWithCustomer } from '@/shared/entities/proposals/dal/server/queries'
import { isSeniorByAge } from '@/shared/entities/customers/lib/customer-predicates'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { sowToPlaintext } from '@/shared/lib/tiptap-to-text'
import { isLongSow } from '../is-long-sow'

/**
 * Pure snapshot for predicates + field sources. `ageOverride` only
 * feeds `isSenior` (rules-only) — field sources still resolve `ho-age`
 * from the saved customer record, so an override never affects values
 * shipped to Zoho.
 *
 * Reads `proposal.kind` directly rather than re-deriving from
 * `meetingProjectId` — kind is frozen at insert and is the canonical
 * routing key for the envelope assembler.
 */
export function buildProposalContext(
  proposal: ProposalWithCustomer,
  options: { ageOverride?: number } = {},
): ProposalContext {
  const sowText = sowToPlaintext(proposal.projectJSON.data.sow ?? [])
  const ageForSeniorCheck = options.ageOverride ?? proposal.customer?.customerAge
  const originalContractDate = proposal.projectFirstContractSentAt
    ? new Date(proposal.projectFirstContractSentAt)
    : null
  return {
    proposal,
    kind: proposal.kind,
    isSenior: isSeniorByAge(ageForSeniorCheck),
    isLongSow: isLongSow(sowText),
    finalTcp: computeFinalTcp(proposal.fundingJSON.data),
    sowText,
    originalContractDate,
  }
}
