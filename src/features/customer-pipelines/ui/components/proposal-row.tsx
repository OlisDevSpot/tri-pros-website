'use client'

import type { CustomerProfileProposal } from '@/features/customer-pipelines/types'

import { ExternalLinkIcon, EyeIcon, FlameIcon } from 'lucide-react'

import { PROPOSAL_STATUS_COLORS } from '@/features/customer-pipelines/constants/proposal-status-colors'
import { EntityViewButton } from '@/shared/components/entity-actions/entity-view-button'
import { Badge } from '@/shared/components/ui/badge'
import { ROOTS } from '@/shared/config/roots'

interface Props {
  proposal: CustomerProfileProposal
}

export function ProposalRow({ proposal }: Props) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
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
        <EntityViewButton
          className="h-6 w-6"
          icon={ExternalLinkIcon}
          href={`${ROOTS.dashboard.root}?step=edit-proposal&proposalId=${proposal.id}`}
        />
      </div>
    </div>
  )
}
