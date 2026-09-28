'use client'

import { BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

import { CHART_MARGIN, CHART_X_AXIS_HEIGHT } from '@/features/analytics/constants/chart-series'
import { compactDollars } from '@/features/analytics/lib/format-analytics'
import { formatAsCount } from '@/shared/lib/formatters'

interface Props {
  ticks: number[]
  format: 'count' | 'money'
  height: number
}

/** The y-axis alone, outside the scroller, so it stays put while the bars scroll. */
export function TrendAxis({ ticks, format, height }: Props) {
  return (
    <div aria-hidden="true" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
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
      </ResponsiveContainer>
    </div>
  )
}
