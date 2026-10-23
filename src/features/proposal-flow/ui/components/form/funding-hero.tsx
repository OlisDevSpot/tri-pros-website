import type { ReactNode } from 'react'
import { LoadingValue } from '@/features/proposal-flow/ui/components/edit-page/loading-value'
import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  finalPrice: number
  totalIncentives: number
  depositField: ReactNode
}

export function FundingHero({ finalPrice, totalIncentives, depositField }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)] md:items-start">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price</span>
        <span className="font-sans text-3xl font-semibold tabular-nums">
          <LoadingValue width={150}>{formatAsDollars(finalPrice)}</LoadingValue>
        </span>
        {/* The line keeps its height when there is nothing to say, so the Deposit field stacked below never moves
            as incentives come and go (or arrive with the proposal). */}
        <span className="min-h-5 text-sm text-muted-foreground">
          {totalIncentives > 0 && `after ${formatAsDollars(totalIncentives)} in incentives`}
        </span>
      </div>
      {depositField}
    </div>
  )
}
