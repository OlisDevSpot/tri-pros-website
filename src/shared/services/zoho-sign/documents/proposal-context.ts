import type { ProposalContext } from './types'
import type { EnvelopeScenario } from '@/shared/constants/enums'
import type { ProposalWithCustomer } from '@/shared/dal/server/proposals/api'
import { isSeniorByAge } from '@/shared/entities/customers/lib/customer-predicates'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { sowToPlaintext } from '@/shared/lib/tiptap-to-text'
import { isLongSow } from '../lib/is-long-sow'

interface BuildContextInput {
  proposal: ProposalWithCustomer
  /**
   * The proposal's meeting's projectId. `null` = initial sale (project
   * will be created if proposal is approved). Non-null = upsell on an
   * existing project. Caller is responsible for fetching this — keeps
   * the builder pure.
   */
  meetingProjectId: string | null
}

/**
 * Builds the snapshot all envelope-document predicates and field
 * sources resolve against. Pure: same input, same output, no I/O. Built
 * once per draft creation; passed through to evaluator + assembler.
 */
export function buildProposalContext({ proposal, meetingProjectId }: BuildContextInput): ProposalContext {
  const scenario: EnvelopeScenario = meetingProjectId !== null ? 'upsell' : 'initial'
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
