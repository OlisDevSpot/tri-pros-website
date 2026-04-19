'use client'

import type { CustomerProfileProposal } from '@/shared/entities/customers/types'

import { useCallback } from 'react'

import { ROOTS } from '@/shared/config/roots'
import { ProposalOverviewCard } from '@/shared/entities/proposals/components/overview-card'
import { PROPOSAL_ROW_STYLES } from '@/shared/entities/proposals/constants/proposal-row-styles'
import { cn } from '@/shared/lib/utils'

interface Props {
  proposal: CustomerProfileProposal
  onMutationSuccess: () => void
  onNavigate?: () => void
}

export function MeetingProposalRow({ proposal, onMutationSuccess: _onMutationSuccess, onNavigate }: Props) {
  const handleView = useCallback(() => {
    window.open(`${ROOTS.public.proposals()}/proposal/${proposal.id}`, '_blank')
  }, [proposal.id])

  const handleEdit = useCallback(() => {
    onNavigate?.()
    window.location.href = ROOTS.dashboard.proposals.byId(proposal.id)
  }, [proposal.id, onNavigate])

  const style = PROPOSAL_ROW_STYLES[proposal.status] ?? PROPOSAL_ROW_STYLES.draft

  return (
    <ProposalOverviewCard
      proposal={proposal}
      onView={handleView}
      onEdit={handleEdit}
      className={cn(
        // Grid (not flex) so the leading StatusIconTile can use `h-full
        // aspect-square` and resolve to a true square — flex doesn't derive
        // inline-size from stretched block-size reliably. `items-stretch`
        // makes each cell's block-size equal the tallest cell; padding
        // defines the outer envelope so the tile respects it.
        'group grid grid-cols-[auto_minmax(0,1fr)_auto] items-stretch gap-2 rounded-md px-3 py-2 transition-colors',
        style.bg,
      )}
    >
      <ProposalOverviewCard.StatusIconTile />
      {/* Label + trade stacked vertically. Status badge sits to the right of
          the label (trailing state badge convention) so the reading order is
          "[icon] [proposal label] [state] · [trade]". */}
      <div className="flex min-w-0 flex-col justify-center gap-0.5">
        <div className="flex items-center gap-1.5">
          <ProposalOverviewCard.Label className="truncate text-sm font-medium" />
          <ProposalOverviewCard.StatusBadge className="shrink-0" />
        </div>
        <ProposalOverviewCard.Trade />
      </div>
      <div className="flex items-center gap-2 self-center">
        <ProposalOverviewCard.Value className="text-sm" />
        <ProposalOverviewCard.ViewCount />
        <ProposalOverviewCard.Actions mode="compact" className="opacity-60 hover:opacity-100 transition-opacity" />
      </div>
    </ProposalOverviewCard>
  )
}
