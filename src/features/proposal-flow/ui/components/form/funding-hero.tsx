import { LoadingValue } from '@/features/proposal-flow/ui/components/edit-page/loading-value'
import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  finalPrice: number
  totalIncentives: number
}

export function FundingHero({ finalPrice, totalIncentives }: Props) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Final price</span>
      <span className="font-sans text-3xl font-semibold tabular-nums">
        <LoadingValue width={150}>{formatAsDollars(finalPrice)}</LoadingValue>
      </span>
      {/* The line keeps its height when there is nothing to say, so the grid below never moves as incentives
          come and go (or arrive with the proposal). */}
      <span className="min-h-5 text-sm text-muted-foreground">
        {totalIncentives > 0 && `after ${formatAsDollars(totalIncentives)} in incentives`}
      </span>
    </div>
  )
}
