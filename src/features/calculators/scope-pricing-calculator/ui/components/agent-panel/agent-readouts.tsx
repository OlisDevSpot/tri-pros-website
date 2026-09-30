import type { QuoteResult } from '@/features/calculators/scope-pricing-calculator/types'

import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { MULTIPLIER_STYLES } from '@/shared/modules/proposals/core/constants/multiplier-styles'
import { formatMultiplier } from '@/shared/modules/proposals/core/lib/financials/tiers'

interface Props {
  quote: QuoteResult
}

export function AgentReadouts({ quote }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Price</dt>
        <dd className="text-right font-medium tabular-nums">{formatAsDollars(quote.totalPrice)}</dd>
        <dt className="text-muted-foreground">Cost</dt>
        <dd className="text-right tabular-nums">{formatAsDollars(quote.totalCost)}</dd>
        <dt className="text-muted-foreground">Margin</dt>
        <dd className="text-right tabular-nums">{formatAsDollars(quote.margin)}</dd>
        <dt className="text-muted-foreground">Multiplier</dt>
        <dd className={cn('text-right font-semibold tabular-nums', MULTIPLIER_STYLES[quote.tier])}>{formatMultiplier(quote.effectiveMultiplier)}</dd>
        <dt className="text-muted-foreground">Tax (inside the price)</dt>
        <dd className="text-right tabular-nums">{formatAsDollars(quote.totalTax)}</dd>
        <dt className="text-muted-foreground">Base</dt>
        <dd className="text-right tabular-nums">{formatAsDollars(quote.totalBase)}</dd>
      </dl>
      {quote.hasUncostedLines && (
        <p className="text-xs text-status-pending-fg">
          Manual lines have no cost data, so they are left out of cost, margin and multiplier.
        </p>
      )}
    </div>
  )
}
