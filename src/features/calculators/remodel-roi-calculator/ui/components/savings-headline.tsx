import type { ProjectionSummary } from '@/features/calculators/remodel-roi-calculator/types'

import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'
import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  summary: ProjectionSummary
}

export function SavingsHeadline({ summary }: Props) {
  const span = formatYears(summary.horizonYears)
  const saves = summary.cumulativeSavings >= 0

  return (
    <section aria-label="Savings" className="flex flex-col gap-1 rounded-xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{saves ? `Savings over ${span}` : `Extra spent over ${span}`}</p>
      <p className="text-4xl font-semibold tabular-nums">{formatAsDollars(Math.abs(summary.cumulativeSavings))}</p>
      <p className="text-sm">
        {summary.breakEvenYear == null
          ? `Does not come out ahead within ${span}`
          : `Comes out ahead in year ${summary.breakEvenYear}`}
      </p>
      <p className="text-xs text-muted-foreground">
        {`Counting home value and what is left on the loan, after ${span} you are ${formatAsDollars(Math.abs(summary.netBenefit))} ${summary.netBenefit >= 0 ? 'ahead' : 'behind'}.`}
      </p>
    </section>
  )
}
