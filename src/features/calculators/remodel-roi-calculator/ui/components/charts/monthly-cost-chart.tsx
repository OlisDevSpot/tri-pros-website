'use client'

import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { useState } from 'react'

import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
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
  const legend = view === 'trend'
    ? [{ label: STORY_COPY.paths.now, swatch: 'bg-primary' }, { label: STORY_COPY.paths.wait, swatch: 'bg-warning' }]
    : [{ label: 'Bills', swatch: 'bg-muted-foreground/35' }, { label: 'Project loan', swatch: 'bg-primary' }, { label: 'Repairs', swatch: 'bg-warning/40' }, { label: 'Replacement loans', swatch: 'bg-warning' }]
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <LegendSwatches items={legend} />
        <ToggleGroup aria-label="Chart view" onValueChange={value => (value === 'trend' || value === 'breakdown') && setView(value)} type="single" value={view} variant="outline">
          <ToggleGroupItem className="h-11 flex-none px-3 text-xs" value="trend">Trend</ToggleGroupItem>
          <ToggleGroupItem className="h-11 flex-none px-3 text-xs" value="breakdown">What makes it up</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {view === 'trend' ? <MonthlyTrendChart lookAhead={lookAhead} projection={projection} /> : <MonthlyBreakdownChart lookAhead={lookAhead} projection={projection} />}
    </div>
  )
}
