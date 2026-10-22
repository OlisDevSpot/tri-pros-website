import type { Proposal } from '@/shared/db/schema'
import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'
import { PROPOSAL_ROW_STYLES } from '@/shared/modules/proposals/core/constants/proposal-row-styles'

interface Props {
  status: Proposal['status']
  className?: string
}

export function ProposalStatusChip({ status, className }: Props) {
  return (
    <Badge variant="outline" className={cn('shrink-0 text-xs capitalize', PROPOSAL_ROW_STYLES[status].textClass, className)}>
      {status}
    </Badge>
  )
}
