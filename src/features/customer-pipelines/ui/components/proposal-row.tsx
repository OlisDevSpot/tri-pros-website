'use client'

import type { CustomerProfileProposal } from '@/features/customer-pipelines/types'

import { EyeIcon, FlameIcon } from 'lucide-react'
import { useCallback } from 'react'

import { PROPOSAL_STATUS_COLORS } from '@/features/customer-pipelines/constants/proposal-status-colors'
import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { Badge } from '@/shared/components/ui/badge'
import { ROOTS } from '@/shared/config/roots'
import { useProposalActionConfigs } from '@/shared/entities/proposals/hooks/use-proposal-action-configs'

interface Props {
  proposal: CustomerProfileProposal
}

export function ProposalRow({ proposal }: Props) {
  const handleView = useCallback(() => {
    window.open(`${ROOTS.public.proposals()}/proposal/${proposal.id}`, '_blank')
  }, [proposal.id])

  const handleEdit = useCallback(() => {
    window.location.href = ROOTS.dashboard.proposals.byId(proposal.id)
  }, [proposal.id])

  const { actions: proposalActions, DeleteConfirmDialog } = useProposalActionConfigs<CustomerProfileProposal>({
    onView: handleView,
    onEdit: handleEdit,
  })

  return (
    <>
      <DeleteConfirmDialog />
      <div className="group flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="secondary" className={`text-[10px] ${PROPOSAL_STATUS_COLORS[proposal.status] ?? ''}`}>
            {proposal.status}
          </Badge>
          <span className="text-sm truncate max-w-48">{proposal.label || 'Untitled'}</span>
          {proposal.trade && (
            <span className="text-xs text-muted-foreground truncate">{proposal.trade}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {proposal.value != null && proposal.value > 0 && (
            <span className="text-green-600 font-medium text-sm tabular-nums">
              $
              {proposal.value.toLocaleString()}
            </span>
          )}
          {proposal.viewCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              {proposal.viewCount >= 3 && <FlameIcon size={11} className="text-orange-500" />}
              <EyeIcon size={11} />
              {proposal.viewCount}
            </span>
          )}
          <EntityActionMenu
            entity={proposal}
            actions={proposalActions}
            mode="compact"
          />
        </div>
      </div>
    </>
  )
}
