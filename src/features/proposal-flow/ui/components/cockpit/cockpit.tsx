'use client'

import type { ProposalOverviewCardData } from '@/shared/modules/proposals/core/components/overview-card'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { PROPOSAL_CUSTOMER_OVERRIDES } from '@/features/proposal-flow/lib/customer-action-overrides'
import { InternalFinancialsModal } from '@/features/proposal-flow/ui/components/internal-financials-modal'
import { ResponsiveSheet } from '@/shared/components/dialogs/sheets/responsive-sheet'
import { useIdleReady } from '@/shared/hooks/use-idle-ready'
import { copyToClipboard } from '@/shared/lib/clipboard'
import { openModal } from '@/shared/lib/open-modal'
import { sowToPlaintext } from '@/shared/lib/tiptap-to-text'
import { CustomerActionsHost } from '@/shared/modules/customers/core/components/customer-actions-host'
import { MeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'
import { ProposalOverviewCard } from '@/shared/modules/proposals/core/components/overview-card'
import { ProposalActionsHost } from '@/shared/modules/proposals/core/components/proposal-actions-host'
import { computeFinalTcp } from '@/shared/modules/proposals/core/lib/financials'
import { toFundingInputs } from '@/shared/modules/proposals/core/lib/funding-columns'
import { useTRPC } from '@/trpc/helpers'

import { AgreementStep } from './agreement-step'
import { ChoiceStep } from './choice-step'
import { CockpitHeader } from './cockpit-header'
import { useCockpitOpen } from './cockpit-open-context'
import { CustomerRow } from './customer-row'
import { MeetingRow } from './meeting-row'
import { ShareStep } from './share-step'

export function Cockpit() {
  const { proposal } = useProposalDocument()
  const { open, setOpen } = useCockpitOpen()
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const isIdle = useIdleReady()
  const customerId = proposal.customer?.id

  // The heaviest read on the page (meetings, notes, projects), fetched once the page settles so the sheet opens on data.
  useEffect(() => {
    if (isIdle && customerId) {
      void queryClient.prefetchQuery(trpc.customerPipelinesRouter.getCustomerProfile.queryOptions({ customerId }))
    }
  }, [isIdle, customerId, queryClient, trpc])

  const views = useQuery({ ...trpc.proposalsRouter.views.getProposalViews.queryOptions({ proposalId: proposal.id }), enabled: isIdle })

  const card = useMemo<ProposalOverviewCardData>(() => ({
    id: proposal.id,
    token: proposal.token,
    status: proposal.status,
    label: proposal.label,
    createdAt: proposal.createdAt,
    sentAt: proposal.sentAt,
    value: computeFinalTcp({ funding: toFundingInputs(proposal), sow: proposal.projectJSON.data.sow }),
    viewCount: views.data?.totalViews,
  }), [proposal, views.data?.totalViews])

  const proposalOverrides = useMemo(() => ({
    // The page is the proposal, so View (and the card's click, which runs it) has nowhere to go.
    onView: () => {},
    onInternalFinancials: () => openModal({
      accessor: 'InternalFinancials',
      Component: InternalFinancialsModal,
      props: { funding: toFundingInputs(proposal), sow: proposal.projectJSON.data.sow, priceDisplayMode: proposal.priceDisplayMode },
    }),
    onCopySow: () => copyToClipboard(sowToPlaintext(proposal.projectJSON.data.sow), 'Scope of work'),
  }), [proposal])

  // The hosts and the card root sit outside the sheet: its header renders outside the body, and context crosses the portal.
  return (
    <ProposalActionsHost overrides={proposalOverrides}>
      <MeetingActionsHost>
        <CustomerActionsHost overrides={PROPOSAL_CUSTOMER_OVERRIDES}>
          <ProposalOverviewCard proposal={card} className="contents">
            <ResponsiveSheet
              open={open}
              onOpenChange={setOpen}
              contentId="proposal-cockpit"
              title="Cockpit"
              header={<CockpitHeader />}
              sheetClassName="sm:max-w-110"
              drawerClassName="max-h-[88dvh]"
              bodyClassName="scrollbar-none px-3.5 pt-3.5"
            >
              <div className="grid content-start gap-3">
                <ShareStep />
                <ChoiceStep />
                <AgreementStep />
                {customerId && <CustomerRow customerId={customerId} />}
                {customerId && proposal.meetingId && <MeetingRow customerId={customerId} meetingId={proposal.meetingId} />}
              </div>
            </ResponsiveSheet>
          </ProposalOverviewCard>
        </CustomerActionsHost>
      </MeetingActionsHost>
    </ProposalActionsHost>
  )
}
