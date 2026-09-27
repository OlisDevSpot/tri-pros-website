import type { QuoteResult } from '@/features/calculators/scope-pricing-calculator/types'

import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  quote: QuoteResult
}

export function QuoteTotal({ quote }: Props) {
  const unfinished = quote.lines.filter(line => line.status === 'incomplete').length

  return (
    <section aria-label="Your price" className="sticky bottom-0 rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-sm text-muted-foreground">Your price</p>
      <p className="text-4xl font-semibold tabular-nums">{formatAsDollars(quote.totalPrice)}</p>
      <p className="text-xs text-muted-foreground">Includes tax</p>
      {unfinished > 0 && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          {unfinished === 1 ? '1 line needs details and is not in this price yet' : `${unfinished} lines need details and are not in this price yet`}
        </p>
      )}
    </section>
  )
}
