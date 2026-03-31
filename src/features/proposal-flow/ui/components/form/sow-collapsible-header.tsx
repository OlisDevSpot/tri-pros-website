import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { ChevronDownIcon, TrashIcon } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface Props {
  isOpen: boolean
  onDelete: (e: React.MouseEvent) => void
  pricingMode: 'total' | 'breakdown'
  sow: ProposalFormSchema['project']['data']['sow'][0]
}

export function SOWCollapsibleHeader({
  isOpen,
  onDelete,
  pricingMode,
  sow,
}: Props) {
  const hasTitle = sow.title.trim().length > 0
  const hasTrade = sow.trade.label.trim().length > 0
  const scopeCount = sow.scopes.length
  const showPrice = pricingMode === 'breakdown' && sow.price != null && sow.price > 0

  return (
    <div className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-lg px-4 py-3 transition-colors hover:bg-muted/50">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className={cn(
          'text-base font-medium truncate',
          !hasTitle && 'text-muted-foreground italic',
        )}>
          {hasTitle ? sow.title : 'Untitled Section'}
        </span>
        {(hasTrade || scopeCount > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {hasTrade && (
              <Badge variant="secondary" className="bg-primary/10 text-xs text-primary">
                {sow.trade.label}
              </Badge>
            )}
            {scopeCount > 0 && (
              <Badge variant="secondary" className="bg-muted text-xs text-muted-foreground">
                {scopeCount} {scopeCount === 1 ? 'scope' : 'scopes'}
              </Badge>
            )}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
        >
          <TrashIcon className="size-4" />
        </Button>
        {showPrice && (
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            ${sow.price!.toLocaleString()}
          </span>
        )}
        <ChevronDownIcon
          className={cn(
            'size-5 text-muted-foreground transition-transform duration-200',
            !isOpen && '-rotate-90',
          )}
        />
      </div>
    </div>
  )
}
