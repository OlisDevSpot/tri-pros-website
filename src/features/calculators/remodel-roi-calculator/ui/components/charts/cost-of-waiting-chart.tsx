import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { COST_OF_WAITING_CHART_CONFIG } from '@/features/calculators/remodel-roi-calculator/constants/chart-configs'
import { buildCostOfWaiting } from '@/features/calculators/remodel-roi-calculator/lib/build-cost-of-waiting'
import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'
import { CostOfWaitingRows } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/cost-of-waiting-rows'
import { LegendSwatches } from '@/shared/components/charts/legend-swatches'

interface Props {
  projection: RemodelRoiProjection
}

export function CostOfWaitingChart({ projection }: Props) {
  const { growth, max, trades } = buildCostOfWaiting(projection)
  if (!trades.length) {
    return null
  }
  return (
    <div className="grid gap-3">
      <LegendSwatches config={COST_OF_WAITING_CHART_CONFIG} />
      <div className="grid gap-4.5">
        {trades.map(trade => (
          <div className="grid gap-1.5" key={trade.trade}>
            <p className="text-sm font-extrabold">
              {trade.label}
              <span className="ml-1.5 text-xs font-semibold text-muted-foreground">
                gives out in about
                {' '}
                {formatYears(trade.givesOutYear)}
              </span>
            </p>
            <CostOfWaitingRows growth={growth} max={max} trade={trade} />
          </div>
        ))}
      </div>
    </div>
  )
}
