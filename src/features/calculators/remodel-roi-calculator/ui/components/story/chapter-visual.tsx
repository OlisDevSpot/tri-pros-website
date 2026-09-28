import type { DetailChapterId } from '@/features/calculators/remodel-roi-calculator/constants/chapters'
import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { BillsByCategoryChart } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/bills-by-category-chart'
import { CostOfWaitingChart } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/cost-of-waiting-chart'
import { HomeValueChart } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/home-value-chart'
import { MonthlyCostChart } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/monthly-cost-chart'
import { PayForItselfChart } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/pay-for-itself-chart'
import { ReturnBreakdown } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/return-breakdown'

interface Props {
  chapter: DetailChapterId
  projection: RemodelRoiProjection
  lookAhead: LookAheadYears
}

export function ChapterVisual({ chapter, projection, lookAhead }: Props) {
  if (chapter === 'waiting' && !projection.replacements.length) {
    return null
  }
  const body = {
    today: <BillsByCategoryChart lookAhead={lookAhead} projection={projection} />,
    monthly: <MonthlyCostChart lookAhead={lookAhead} projection={projection} />,
    waiting: <CostOfWaitingChart projection={projection} />,
    value: <HomeValueChart lookAhead={lookAhead} projection={projection} />,
    total: (
      <div className="grid gap-5">
        <PayForItselfChart lookAhead={lookAhead} projection={projection} />
        <ReturnBreakdown lookAhead={lookAhead} projection={projection} />
      </div>
    ),
  }[chapter]
  return <div className="grid gap-1 rounded-xl border bg-card px-5 pt-4.5 pb-3.5 shadow-sm">{body}</div>
}
