'use client'

import type { ChartSeriesKey } from '@/features/analytics/constants/chart-series'
import type { AnalyticsInterval } from '@/features/analytics/constants/dimensions'
import type { ChartRow } from '@/features/analytics/lib/chart-rows'

import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { CHART_MARGIN, CHART_X_AXIS_HEIGHT, SERIES_COLORS } from '@/features/analytics/constants/chart-series'
import { METRICS } from '@/features/analytics/constants/metrics'
import { CHART_BAR_GAP, groupedBarSize } from '@/features/analytics/lib/chart-bar-size'
import { chartBucketTitle, chartTickLabel } from '@/features/analytics/lib/chart-rows'
import { metricDisplayText } from '@/features/analytics/lib/read-metric'
import { ChartTooltipCard } from '@/shared/components/charts/chart-tooltip-card'

interface Props {
  rows: ChartRow[]
  interval: AnalyticsInterval
  series: readonly ChartSeriesKey[]
  /** The fixed axis's scale; this plot hides its own axis but draws gridlines on the same ticks. */
  ticks: number[]
  height: number
  tooltipActive?: boolean
  /** Every click or tap on a bucket; the plot decides which ones zoom. */
  onBucket?: (row: ChartRow) => void
}

/** One grouped-bar panel; panels share a sync id so one hover reads counts and dollars together. */
export function TrendBars({ rows, interval, series, ticks, height, tooltipActive, onBucket }: Props) {
  const [plotWidth, setPlotWidth] = useState(0)
  const label = series.map(key => METRICS[key].label).join(', ')
  return (
    <div role="img" aria-label={`${label} by ${interval}`} style={{ height }} className={onBucket ? 'cursor-pointer touch-manipulation select-none' : undefined}>
      <ResponsiveContainer width="100%" height="100%" onResize={width => setPlotWidth(width)}>
        <BarChart
          data={rows}
          syncId="analytics-trend"
          barGap={CHART_BAR_GAP}
          barCategoryGap="20%"
          barSize={groupedBarSize(plotWidth - CHART_MARGIN.left - CHART_MARGIN.right, rows.length, series.length)}
          margin={CHART_MARGIN}
          onClick={(chart) => {
            const row = chart?.activeTooltipIndex === undefined ? undefined : rows[chart.activeTooltipIndex]
            if (row && onBucket) {
              onBucket(row)
            }
          }}
        >
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
          <XAxis
            dataKey="key"
            height={CHART_X_AXIS_HEIGHT}
            interval={0}
            tickFormatter={(key: string, index: number) => chartTickLabel(interval, key, rows[index - 1]?.key)}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tick={{ fill: 'var(--muted-foreground)' }}
            className="text-xs"
          />
          <YAxis hide domain={[0, ticks[ticks.length - 1]]} ticks={ticks} />
          <Tooltip
            active={tooltipActive}
            cursor={{ fill: 'var(--muted)', fillOpacity: 0.6 }}
            content={({ active, payload }) => {
              const row: ChartRow | undefined = payload?.[0]?.payload
              if (!active || !row) {
                return null
              }
              const shown = series.map(key => ({ label: METRICS[key].label, value: row.displays[key] ? metricDisplayText(row.displays[key]) : '—', swatch: SERIES_COLORS[key].swatch }))
              return <ChartTooltipCard title={chartBucketTitle(interval, row.key, row.last)} rows={shown} />
            }}
          />
          {series.map(key => (
            <Bar key={key} dataKey={(row: ChartRow) => row.values[key] ?? null} name={METRICS[key].label} fill={SERIES_COLORS[key].fill} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
