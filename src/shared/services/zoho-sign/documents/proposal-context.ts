import type { ProposalContext } from './types'
import type { EnvelopeScenario } from '@/shared/constants/enums'
import type { ProposalWithCustomer } from '@/shared/dal/server/proposals/api'
import { isSeniorByAge } from '@/shared/entities/customers/lib/customer-predicates'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { sowToPlaintext } from '@/shared/lib/tiptap-to-text'
import { isLongSow } from '../lib/is-long-sow'

/**
 * Builds the snapshot all envelope-document predicates and field
 * sources resolve against. Pure: same input, same output, no I/O. Built
 * once per draft creation; passed through to evaluator + assembler.
 *
 * Scenario is derived from the proposal's meeting's projectId — null
 * means initial sale (a new project will be created if the proposal
 * is approved); non-null means upsell on an existing project. The
 * meeting-projectId join lives in the DAL's getProposal so callers
 * don't need to fetch it separately.
 */
export function buildProposalContext(proposal: ProposalWithCustomer): ProposalContext {
  const scenario: EnvelopeScenario = proposal.meetingProjectId !== null ? 'upsell' : 'initial'
  const sowText = sowToPlaintext(proposal.projectJSON.data.sow ?? [])
  return {
    proposal,
    scenario,
    isSenior: isSeniorByAge(proposal.customer?.customerAge),
    isLongSow: isLongSow(sowText),
    finalTcp: computeFinalTcp(proposal.fundingJSON.data),
    sowText,
  }
}
