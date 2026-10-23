import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { format } from 'date-fns'
import { ChevronDownIcon } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

type Incentive = ProposalFormSchema['funding']['incentives'][number]

interface Props {
  incentive: Incentive
  isOpen: boolean
}

export function IncentiveCollapsibleHeader({
  incentive,
  isOpen,
}: Props) {
  const typeLabel = incentive.type === 'discount' ? 'Discount' : 'Exclusive Offer'
  const hasAmount = incentive.type === 'discount' && incentive.amount > 0
  const hasOffer = incentive.type === 'exclusive-offer' && incentive.offer?.trim()
  const hasExpiry = incentive.expiresAt != null
  const hasNotes = incentive.notes?.trim()

  return (
    <div className="flex w-full cursor-pointer flex-col gap-1 px-3 py-2.5 transition-colors hover:bg-row-hover pressed:bg-row-press lg:px-4 lg:py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-medium lg:text-base">
            {typeLabel}
          </span>
          {hasAmount && (
            <Badge variant="secondary" className="text-xs font-semibold tabular-nums">
              -
              {formatAsDollars(incentive.amount)}
            </Badge>
          )}
          {hasOffer && (
            <Badge variant="secondary" className="text-xs">
              {incentive.offer}
            </Badge>
          )}
          {hasExpiry && (
            <Badge variant="secondary" className="bg-status-pending-bg text-xs text-status-pending-fg">
              Expires
              {' '}
              {format(new Date(incentive.expiresAt!), 'MMM d')}
            </Badge>
          )}
        </div>
        <ChevronDownIcon
          className={cn(
            'size-5 shrink-0 text-muted-foreground transition-transform duration-200',
            !isOpen && '-rotate-90',
          )}
        />
      </div>
      {hasNotes && !isOpen && (
        <p className="truncate text-xs text-muted-foreground">
          {incentive.notes}
        </p>
      )}
    </div>
  )
}
