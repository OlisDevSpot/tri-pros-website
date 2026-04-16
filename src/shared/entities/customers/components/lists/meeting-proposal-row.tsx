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
        'group flex items-center gap-2 rounded-md px-3 py-2 transition-colors',
        style.bg,
      )}
    >
      <ProposalOverviewCard.StatusIcon size="md" />
      <ProposalOverviewCard.StatusBadge />
      <ProposalOverviewCard.Label className="truncate max-w-48 text-sm font-medium" />
      <ProposalOverviewCard.Trade />
      <div className="flex-1" />
      <ProposalOverviewCard.Value className="text-sm" />
      <ProposalOverviewCard.ViewCount />
      <ProposalOverviewCard.Actions mode="compact" className="opacity-60 hover:opacity-100 transition-opacity" />
    </ProposalOverviewCard>
  )
}
