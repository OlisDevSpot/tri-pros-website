'use client'

import { COCKPIT_SHARE_ONLY, COCKPIT_SHARE_TOOLBAR } from '@/features/proposal-flow/constants/cockpit-actions'
import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { formatBusinessTime } from '@/shared/lib/business-time'
import { ProposalOverviewCard, useProposalOverviewCard } from '@/shared/modules/proposals/core/components/overview-card'
import { canSendProposal } from '@/shared/modules/proposals/core/lib/can-send-proposal'
import { isProposalFrozen } from '@/shared/modules/proposals/core/lib/proposal-lock'

import { CockpitStep } from './cockpit-step'
import { SendComposer } from './send-composer'

export function ShareStep() {
  const { proposal } = useProposalDocument()
  const { proposal: card } = useProposalOverviewCard()
  const views = card.viewCount
  // The count is left out until it has loaded, so a slow or failed read never claims no views.
  const status = proposal.sentAt
    ? [`Sent ${formatBusinessTime(proposal.sentAt, { month: 'short', day: 'numeric' })}`, views !== undefined && `${views} ${views === 1 ? 'view' : 'views'}`].filter(Boolean).join(' · ')
    : 'Not sent yet'

  return (
    <CockpitStep number={1} title="Share" status={status}>
      {canSendProposal(proposal)
        ? <SendComposer />
        : (
            <>
              <p className="text-sm text-muted-foreground">
                {isProposalFrozen(proposal)
                  ? 'The proposal is in its agreement, so it can’t be sent again.'
                  : `This proposal is ${proposal.status}, so it can’t be sent again.`}
              </p>
              <ProposalOverviewCard.Actions mode="toolbar" roles={COCKPIT_SHARE_TOOLBAR} show={COCKPIT_SHARE_ONLY} className="flex-nowrap" />
            </>
          )}
    </CockpitStep>
  )
}
