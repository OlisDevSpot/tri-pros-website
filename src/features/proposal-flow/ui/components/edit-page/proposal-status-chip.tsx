import type { Proposal } from '@/shared/db/schema'
import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'
import { PROPOSAL_ROW_STYLES } from '@/shared/modules/proposals/core/constants/proposal-row-styles'
import { LoadingValue } from './loading-value'

interface Props {
  status: Proposal['status'] | null
  className?: string
}

export function ProposalStatusChip({ status, className }: Props) {
  return (
    <LoadingValue width={46} block className={cn('shrink-0', className)}>
      {status && (
        <Badge variant="outline" className={cn('shrink-0 text-xs capitalize', PROPOSAL_ROW_STYLES[status].textClass, className)}>
          {status}
        </Badge>
      )}
    </LoadingValue>
  )
}
