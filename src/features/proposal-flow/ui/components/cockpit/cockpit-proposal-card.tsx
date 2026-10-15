'use client'

import { COCKPIT_PROPOSAL_HIDDEN_ACTIONS, COCKPIT_PROPOSAL_TOOLBAR } from '@/features/proposal-flow/constants/cockpit-actions'
import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { ProposalOverviewCard } from '@/shared/modules/proposals/core/components/overview-card'
import { computeFinalTcp } from '@/shared/modules/proposals/core/lib/financials'
import { toFundingInputs } from '@/shared/modules/proposals/core/lib/funding-columns'
import { isProposalFrozen } from '@/shared/modules/proposals/core/lib/proposal-lock'
import { SendComposer } from './send-composer'

export function CockpitProposalCard() {
  const { proposal } = useProposalDocument()
  const funding = toFundingInputs(proposal)
  // A send stamps status 'sent', so it would reopen an approved or declined proposal; a frozen one is in its agreement.
  const canSend = (proposal.status === 'draft' || proposal.status === 'sent') && !isProposalFrozen(proposal)

  return (
    <ProposalOverviewCard
      proposal={{
        id: proposal.id,
        token: proposal.token,
        status: proposal.status,
        label: proposal.label,
        createdAt: proposal.createdAt,
        sentAt: proposal.sentAt,
        value: computeFinalTcp({ funding, sow: proposal.projectJSON.data.sow }),
      }}
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <ProposalOverviewCard.Header className="border-b border-border px-4 py-3">
        {/* A fixed size: in a flex row `h-full aspect-square` never resolves to a square. */}
        <ProposalOverviewCard.StatusIconTile className="size-9" />
        <div className="min-w-0 flex-1">
          <ProposalOverviewCard.Label className="block font-bold" />
          <ProposalOverviewCard.Fields fields={[{ field: 'status', variant: 'badge' }, { field: 'value' }, { field: 'createdAt', format: 'date-only' }]} />
        </div>
      </ProposalOverviewCard.Header>
      <ProposalOverviewCard.Body className="px-4 py-3">
        <ProposalOverviewCard.Actions mode="toolbar" roles={COCKPIT_PROPOSAL_TOOLBAR} hide={COCKPIT_PROPOSAL_HIDDEN_ACTIONS} />
      </ProposalOverviewCard.Body>
      {canSend && (
        <ProposalOverviewCard.Footer>
          <SendComposer />
        </ProposalOverviewCard.Footer>
      )}
    </ProposalOverviewCard>
  )
}
