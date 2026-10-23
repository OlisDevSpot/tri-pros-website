import type { ReactNode } from 'react'
import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  finalPrice: number
  totalIncentives: number
  depositField: ReactNode
}

export function FundingHero({ finalPrice, totalIncentives, depositField }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)] lg:items-start">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price</span>
        <span className="font-sans text-3xl font-semibold tabular-nums">{formatAsDollars(finalPrice)}</span>
        {totalIncentives > 0 && (
          <span className="text-sm text-muted-foreground">{`after ${formatAsDollars(totalIncentives)} in incentives`}</span>
        )}
      </div>
      {depositField}
    </div>
  )
}
