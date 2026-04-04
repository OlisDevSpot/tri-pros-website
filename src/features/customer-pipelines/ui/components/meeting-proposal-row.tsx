'use client'

import type { CustomerProfileProposal } from '@/features/customer-pipelines/types'

import { EyeIcon } from 'lucide-react'
import { useCallback } from 'react'

import { PROPOSAL_ROW_STYLES } from '@/features/customer-pipelines/constants/proposal-row-styles'
import { useProposalActionConfigs } from '@/features/proposal-flow/hooks/use-proposal-action-configs'
import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { Badge } from '@/shared/components/ui/badge'
import { ROOTS } from '@/shared/config/roots'
import { formatAsDollars } from '@/shared/lib/formatters'
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

  const { actions: proposalActions, DeleteConfirmDialog } = useProposalActionConfigs<CustomerProfileProposal>({
    onView: handleView,
    onEdit: handleEdit,
  })

  const style = PROPOSAL_ROW_STYLES[proposal.status] ?? PROPOSAL_ROW_STYLES.draft
  const StatusIcon = style.icon

  return (
    <>
      <DeleteConfirmDialog />
      <div
        className={cn(
          'group flex items-center gap-2 rounded-md px-3 py-2 transition-colors',
          style.bg,
        )}
      >
        {/* Status icon + badge */}
        <StatusIcon size={14} className={cn('shrink-0', style.iconClass)} />
        <Badge variant="outline" className={cn('text-xs shrink-0', style.textClass)}>
          {proposal.status}
        </Badge>

        {/* Label + trade */}
        <span className={cn('truncate max-w-48 text-sm font-medium', style.textClass)}>
          {proposal.label || 'Untitled'}
        </span>
        {proposal.trade && (
          <span className="text-xs text-muted-foreground truncate">{proposal.trade}</span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Value + views + actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {proposal.value != null && proposal.value > 0 && (
            <span className={cn('text-sm font-semibold', style.valueClass)}>
              {formatAsDollars(proposal.value)}
            </span>
          )}
          {proposal.viewCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <EyeIcon className="size-3" />
              {proposal.viewCount}
            </span>
          )}
          <EntityActionMenu
            entity={proposal}
            actions={proposalActions}
            mode="compact"
            className="opacity-60 hover:opacity-100 transition-opacity"
          />
        </div>
      </div>
    </>
  )
}
