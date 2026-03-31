import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { format } from 'date-fns'
import { ChevronDownIcon, TrashIcon } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

type Incentive = ProposalFormSchema['funding']['data']['incentives'][number]

interface Props {
  incentive: Incentive
  isOpen: boolean
  onDelete: (e: React.MouseEvent) => void
}

export function IncentiveCollapsibleHeader({
  incentive,
  isOpen,
  onDelete,
}: Props) {
  const typeLabel = incentive.type === 'discount' ? 'Discount' : 'Exclusive Offer'
  const hasAmount = incentive.type === 'discount' && incentive.amount > 0
  const hasOffer = incentive.type === 'exclusive-offer' && incentive.offer?.trim()
  const hasExpiry = incentive.expiresAt != null
  const hasNotes = incentive.notes?.trim()

  return (
    <div className="flex w-full cursor-pointer flex-col gap-1 px-3 py-2.5 transition-colors hover:bg-muted/50 lg:px-4 lg:py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-sm font-medium lg:text-base">
            {typeLabel}
          </span>
          {hasAmount && (
            <Badge variant="secondary" className="bg-emerald-500/10 text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              -$
              {incentive.amount.toLocaleString()}
            </Badge>
          )}
          {hasOffer && (
            <Badge variant="secondary" className="bg-primary/10 text-xs text-primary">
              {incentive.offer}
            </Badge>
          )}
          {hasExpiry && (
            <Badge variant="secondary" className="bg-amber-500/10 text-xs text-amber-700 dark:text-amber-400">
              Expires
              {' '}
              {format(new Date(incentive.expiresAt!), 'MMM d')}
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
          >
            <TrashIcon className="size-4" />
          </Button>
          <ChevronDownIcon
            className={cn(
              'size-5 text-muted-foreground transition-transform duration-200',
              !isOpen && '-rotate-90',
            )}
          />
        </div>
      </div>
      {hasNotes && !isOpen && (
        <p className="truncate text-xs text-muted-foreground">
          {incentive.notes}
        </p>
      )}
    </div>
  )
}
