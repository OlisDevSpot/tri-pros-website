'use client'

import type { CustomerProfileProposal } from '@/features/customer-pipelines/types'

import { EyeIcon } from 'lucide-react'
import { useCallback } from 'react'

import { PROPOSAL_STATUS_COLORS } from '@/features/customer-pipelines/constants/proposal-status-colors'
import { useProposalActionConfigs } from '@/features/proposal-flow/hooks/use-proposal-action-configs'
import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { Badge } from '@/shared/components/ui/badge'
import { ROOTS } from '@/shared/config/roots'

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

  const proposalActions = useProposalActionConfigs<CustomerProfileProposal>({
    onView: handleView,
    onEdit: handleEdit,
  })

  return (
    <div className="group flex flex-col gap-1.5 rounded-md border border-border/50 bg-muted/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      {/* Info */}
      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <Badge variant="outline" className={PROPOSAL_STATUS_COLORS[proposal.status] ?? ''}>
          {proposal.status}
        </Badge>
        <span className="truncate max-w-48 text-sm font-medium">{proposal.label || 'Untitled'}</span>
        {proposal.trade && (
          <span className="text-xs text-muted-foreground">{proposal.trade}</span>
        )}
      </div>

      {/* Stats + Actions */}
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        {/* Stats */}
        <div className="flex items-center gap-2.5">
          {proposal.value != null && proposal.value > 0 && (
            <span className="text-sm font-semibold text-green-600">
              $
              {proposal.value.toLocaleString()}
            </span>
          )}
          {proposal.viewCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <EyeIcon className="h-3 w-3" />
              {proposal.viewCount}
            </span>
          )}
        </div>

        {/* Actions */}
        <EntityActionMenu
          entity={proposal}
          actions={proposalActions}
          mode="compact"
        />
      </div>
    </div>
  )
}
