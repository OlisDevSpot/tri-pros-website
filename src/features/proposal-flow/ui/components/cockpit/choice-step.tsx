'use client'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { useGetProposal } from '@/features/proposal-flow/dal/client/queries/use-get-proposal'
import { firstName } from '@/features/proposal-flow/lib/rep-names'

import { useCockpitOpen } from './cockpit-open-context'
import { CockpitStep } from './cockpit-step'
import { FundingChoiceTiles } from './funding-choice-tiles'

const CHOICE_POLL_MS = 15_000

export function ChoiceStep() {
  const { proposal, token } = useProposalDocument()
  const { open } = useCockpitOpen()
  // The homeowner's saves refresh only their own session, so while the agent watches, this read follows their device.
  useGetProposal(proposal.id, token, { refetchInterval: open ? CHOICE_POLL_MS : false })
  const first = firstName(proposal.customer?.name ?? '')

  return (
    <CockpitStep number={2} title={first ? `${first}’s choice` : 'The homeowner’s choice'} status="Updates live">
      <FundingChoiceTiles />
    </CockpitStep>
  )
}
