'use client'

import type { CustomerProfileProposal } from '@/shared/entities/customers/types'

import { EyeIcon, FlameIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { EntityActionMenu } from '@/shared/components/entities/entity-actions/ui/entity-action-menu'
import { Badge } from '@/shared/components/ui/badge'
import { ROOTS } from '@/shared/config/roots'
import { PROPOSAL_STATUS_COLORS } from '@/shared/modules/proposals/core/constants/proposal-status-colors'
import { useProposalActionConfigs } from '@/shared/modules/proposals/core/hooks/use-proposal-action-configs'

interface Props {
  proposal: CustomerProfileProposal
}

export function ProposalRow({ proposal }: Props) {
  const router = useRouter()
  const handleView = useCallback(() => {
    window.open(ROOTS.public.proposalReview(proposal.id), '_blank')
  }, [proposal.id])

  const handleEdit = useCallback(() => {
    router.push(ROOTS.dashboard.proposals.byId(proposal.id))
  }, [proposal.id, router])

  const { actions: proposalActions, DeleteConfirmDialog } = useProposalActionConfigs<CustomerProfileProposal>({
    onView: handleView,
    onEdit: handleEdit,
  })

  return (
    <>
      <DeleteConfirmDialog />
      <div className="group flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="secondary" className={`text-xs ${PROPOSAL_STATUS_COLORS[proposal.status] ?? ''}`}>
            {proposal.status}
          </Badge>
          <span className="text-sm truncate max-w-48">{proposal.label || 'Untitled'}</span>
          {proposal.trade && (
            <span className="text-xs text-muted-foreground truncate">{proposal.trade}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {proposal.value != null && proposal.value > 0 && (
            <span className="text-status-success-fg font-medium text-sm tabular-nums">
              $
              {proposal.value.toLocaleString()}
            </span>
          )}
          {proposal.viewCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
              {proposal.viewCount >= 3 && <FlameIcon size={11} className="text-status-attention-fg" />}
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
