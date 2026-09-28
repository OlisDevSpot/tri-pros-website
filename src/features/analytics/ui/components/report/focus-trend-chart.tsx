'use client'

import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { TrendPoint } from '@/features/analytics/lib/trend-points'
import type { AnalyticsReport } from '@/features/analytics/types'

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { METRICS } from '@/features/analytics/constants/metrics'
import { formatMonthLabel } from '@/features/analytics/lib/format-analytics'
import { formatMetricValue, metricDisplayText } from '@/features/analytics/lib/read-metric'
import { buildTrendPoints } from '@/features/analytics/lib/trend-points'
import { ChartTooltipCard } from '@/shared/components/charts/chart-tooltip-card'

interface Props {
  metric: MetricKey
  report: AnalyticsReport
}

export function FocusTrendChart({ metric, report }: Props) {
  const definition = METRICS[metric]
  const points = buildTrendPoints(report, metric)
  const format = 'format' in definition ? definition.format : 'count'
  return (
    <section aria-label={`${definition.label} by month`} className="flex min-w-0 flex-col gap-3 rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold">
        {definition.label}
        <span className="font-normal text-muted-foreground"> · last 12 months</span>
      </h2>
      {points.every(p => p.value === null)
        ? <p className="text-sm text-muted-foreground">No monthly figures for this with these filters.</p>
        : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tickLine={false} stroke="var(--muted-foreground)" className="text-xs" />
                  <YAxis width={64} tickFormatter={(v: number) => formatMetricValue(v, format)} stroke="var(--muted-foreground)" className="text-xs" />
                  <Tooltip
                    cursor={{ fill: 'var(--muted)' }}
                    content={({ active, payload }) => {
                      const point: TrendPoint | undefined = payload?.[0]?.payload
                      if (!active || !point) {
                        return null
                      }
                      return <ChartTooltipCard title={formatMonthLabel(point.month)} rows={[{ label: definition.label, value: metricDisplayText(point.display) }]} />
                    }}
                  />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {points.map(p => (
                      <Cell key={p.month} fill={p.selected ? 'var(--primary)' : 'var(--muted-foreground)'} fillOpacity={p.selected ? 1 : 0.35} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
    </section>
  )
}
