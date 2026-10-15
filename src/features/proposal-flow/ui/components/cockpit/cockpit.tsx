'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { InternalFinancialsModal } from '@/features/proposal-flow/ui/components/internal-financials-modal'
import { ResponsiveSheet } from '@/shared/components/dialogs/sheets/responsive-sheet'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { CreateMeetingModal } from '@/shared/entities/meetings/components/create-meeting-modal'
import { copyToClipboard } from '@/shared/lib/clipboard'
import { openModal } from '@/shared/lib/open-modal'
import { sowToPlaintext } from '@/shared/lib/tiptap-to-text'
import { CustomerActionsHost } from '@/shared/modules/customers/core/components/customer-actions-host'
import { openCustomerProfile } from '@/shared/modules/customers/core/lib/open-customer-profile'
import { MeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'
import { ProposalActionsHost } from '@/shared/modules/proposals/core/components/proposal-actions-host'
import { toFundingInputs } from '@/shared/modules/proposals/core/lib/funding-columns'
import { useTRPC } from '@/trpc/helpers'
import { CockpitAgreementCard } from './cockpit-agreement-card'
import { CockpitCustomerCard } from './cockpit-customer-card'
import { CockpitMeetingCard } from './cockpit-meeting-card'
import { CockpitProposalCard } from './cockpit-proposal-card'

interface Props { open: boolean, onOpenChange: (open: boolean) => void }

export function Cockpit({ open, onOpenChange }: Props) {
  const { proposal } = useProposalDocument()
  const trpc = useTRPC()
  const [scheduling, setScheduling] = useState<{ id: string, name: string } | null>(null)
  const customerId = proposal.customer?.id
  // The heaviest read on the page (meetings, notes, projects), so it waits for the sheet.
  const profile = useQuery({
    ...trpc.customerPipelinesRouter.getCustomerProfile.queryOptions({ customerId: customerId ?? '' }),
    enabled: open && Boolean(customerId),
  })
  const meeting = profile.data?.meetings.find(m => m.id === proposal.meetingId)

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

  const customerOverrides = useMemo(() => ({
    onView: (customer: { id: string }) => openCustomerProfile({ customerId: customer.id }),
    onScheduleMeeting: (customer: { id: string, name: string }) => setScheduling({ id: customer.id, name: customer.name }),
  }), [])

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Cockpit"
      description={[proposal.customer?.name, proposal.label].filter(Boolean).join(' · ')}
      sheetClassName="sm:max-w-[460px]"
      drawerClassName="max-h-[85dvh]"
      bodyClassName="scrollbar-none"
    >
      <ProposalActionsHost overrides={proposalOverrides}>
        <MeetingActionsHost>
          <CustomerActionsHost overrides={customerOverrides}>
            <div className="grid content-start gap-3 py-1">
              <CockpitProposalCard />
              <CockpitAgreementCard />
              {customerId && profile.isPending && (
                <>
                  <Skeleton className="h-48 rounded-lg" />
                  <Skeleton className="h-24 rounded-lg" />
                </>
              )}
              {profile.isError && <p className="text-sm text-muted-foreground">This customer’s profile isn’t available to you.</p>}
              {profile.data && <CockpitCustomerCard profile={profile.data} />}
              {profile.data && meeting && <CockpitMeetingCard meeting={meeting} />}
            </div>
            {scheduling && (
              <CreateMeetingModal
                isOpen
                customerId={scheduling.id}
                customerName={scheduling.name}
                onClose={() => setScheduling(null)}
              />
            )}
          </CustomerActionsHost>
        </MeetingActionsHost>
      </ProposalActionsHost>
    </ResponsiveSheet>
  )
}
