import type { Proposal } from '@/shared/db/schema'

import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'
import { PROPOSAL_STATUS_COLORS } from '@/shared/modules/proposals/core/constants/proposal-status-colors'

interface Props {
  status: Proposal['status']
  className?: string
}

export function ProposalStatusBadge({ status, className }: Props) {
  return (
    <Badge variant="secondary" className={cn('text-xs capitalize', PROPOSAL_STATUS_COLORS[status], className)}>
      {status}
    </Badge>
  )
}
