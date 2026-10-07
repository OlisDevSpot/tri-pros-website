'use client'

import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { useState } from 'react'

import { MONTHLY_BREAKDOWN_CHART_CONFIG, MONTHLY_TREND_CHART_CONFIG } from '@/features/calculators/remodel-roi-calculator/constants/chart-configs'
import { MonthlyBreakdownChart } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/monthly-breakdown-chart'
import { MonthlyTrendChart } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/monthly-trend-chart'
import { LegendSwatches } from '@/shared/components/charts/legend-swatches'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

interface Props {
  projection: RemodelRoiProjection
  lookAhead: LookAheadYears
}

export function MonthlyCostChart({ projection, lookAhead }: Props) {
  const [view, setView] = useState<'trend' | 'breakdown'>('trend')
  const shown = projection.years.slice(1, lookAhead + 1)
  const breakdownKeys = [
    'nowBills',
    // Each branch is its own `as const`: spreading a plain array here would widen the whole
    // tuple to `string`, past `nowBills`, and LegendSwatches checks these keys against the config.
    ...(projection.project.hasLoan ? ['nowLoan'] as const : [] as const),
    'waitRepairs',
    ...(shown.some(year => year.replacementPayments > 0) ? ['waitLoan'] as const : [] as const),
  ] as const
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LegendSwatches config={view === 'trend' ? MONTHLY_TREND_CHART_CONFIG : MONTHLY_BREAKDOWN_CHART_CONFIG} keys={view === 'trend' ? ['monthlyNow', 'monthlyWait'] : breakdownKeys} />
        <ToggleGroup aria-label="Chart view" onValueChange={value => (value === 'trend' || value === 'breakdown') && setView(value)} type="single" value={view} variant="segmented">
          <ToggleGroupItem className="h-9.5 px-3 text-xs" value="trend">Trend</ToggleGroupItem>
          <ToggleGroupItem className="h-9.5 px-3 text-xs" value="breakdown">What makes it up</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {view === 'trend' ? <MonthlyTrendChart lookAhead={lookAhead} projection={projection} /> : <MonthlyBreakdownChart lookAhead={lookAhead} projection={projection} />}
    </div>
  )
}
