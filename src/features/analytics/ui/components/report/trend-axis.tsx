'use client'

import { BarChart, XAxis, YAxis } from 'recharts'

import { CHART_MARGIN, CHART_X_AXIS_HEIGHT } from '@/features/analytics/constants/chart-series'
import { compactDollars } from '@/features/analytics/lib/format-analytics'
import { ChartContainer } from '@/shared/components/ui/chart'
import { formatAsCount } from '@/shared/lib/formatters'

interface Props {
  ticks: number[]
  format: 'count' | 'money'
  height: number
}

/** The y-axis alone, outside the scroller, so it stays put while the bars scroll. */
export function TrendAxis({ ticks, format, height }: Props) {
  return (
    <ChartContainer aria-hidden className="aspect-auto w-full" config={{}} style={{ height }}>
      <BarChart data={[{}]} margin={CHART_MARGIN}>
        <XAxis height={CHART_X_AXIS_HEIGHT} tick={false} axisLine={false} tickLine={false} />
        <YAxis
          width={48}
          domain={[0, ticks[ticks.length - 1]]}
          ticks={ticks}
          interval={0}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => (format === 'money' ? compactDollars(v) : formatAsCount(v))}
          tick={{ fill: 'var(--muted-foreground)' }}
          className="text-xs"
        />
      </BarChart>
    </ChartContainer>
  )
}
