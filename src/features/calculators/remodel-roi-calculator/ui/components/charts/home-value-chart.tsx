'use client'

import type { TooltipContentProps } from 'recharts'

import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { useReducedMotion } from 'motion/react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import { HOME_VALUE_CHART_CONFIG } from '@/features/calculators/remodel-roi-calculator/constants/chart-configs'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { formatMoney, roundMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { ChartTooltipCard } from '@/shared/components/charts/chart-tooltip-card'
import { LegendSwatches } from '@/shared/components/charts/legend-swatches'
import { ChartContainer, ChartTooltip } from '@/shared/components/ui/chart'
import { usePinnedChartTooltip } from '@/shared/hooks/use-pinned-chart-tooltip'

interface Props {
  projection: RemodelRoiProjection
  lookAhead: LookAheadYears
}

export function HomeValueChart({ projection, lookAhead }: Props) {
  const reduceMotion = useReducedMotion()
  const tooltip = usePinnedChartTooltip()
  const waits = projection.replacements.length > 0
  const data = projection.years.slice(0, lookAhead + 1)
  const content = ({ active, label }: TooltipContentProps) => {
    const year = projection.years[Number(label)]
    return active && year
      ? <ChartTooltipCard rows={[{ label: STORY_COPY.paths.now, value: formatMoney(year.valueNow), swatch: 'bg-primary' }, ...(waits ? [{ label: STORY_COPY.paths.wait, value: formatMoney(year.valueWait), swatch: 'bg-warning' }] : [])]} title={`Year ${label} · value added`} />
      : null
  }
  return (
    <div className="grid gap-1.5">
      <LegendSwatches config={HOME_VALUE_CHART_CONFIG} keys={waits ? ['valueNow', 'valueWait'] : ['valueNow']} />
      <ChartContainer aria-label={`Value added to the home: ${roundMoney(data[lookAhead].valueNow)} by year ${lookAhead} if you upgrade now.`} className="aspect-auto h-56 w-full" config={HOME_VALUE_CHART_CONFIG} debounce={150} role="img" {...tooltip.containerProps}>
        <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis axisLine={false} dataKey="t" tickFormatter={t => (t === 0 ? 'Now' : `Yr ${t}`)} tickLine={false} />
          <YAxis axisLine={false} domain={[0, 'auto']} tickFormatter={value => roundMoney(Number(value))} tickLine={false} width={72} />
          <ChartTooltip active={tooltip.tooltipActive} content={content} />
          {waits && <Line dataKey="valueWait" dot={false} isAnimationActive={!reduceMotion} stroke="var(--color-valueWait)" strokeWidth={2.5} type="stepAfter" />}
          <Line dataKey="valueNow" dot={false} isAnimationActive={!reduceMotion} stroke="var(--color-valueNow)" strokeWidth={2.5} type="monotone" />
        </LineChart>
      </ChartContainer>
    </div>
  )
}
