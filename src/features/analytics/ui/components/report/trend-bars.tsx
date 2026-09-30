'use client'

import type { TooltipContentProps } from 'recharts'

import type { ChartSeriesKey } from '@/features/analytics/constants/chart-series'
import type { AnalyticsInterval } from '@/features/analytics/constants/dimensions'
import type { ChartRow } from '@/features/analytics/lib/chart-rows'

import { useLayoutEffect, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { CHART_MARGIN, CHART_X_AXIS_HEIGHT, SERIES_COLORS } from '@/features/analytics/constants/chart-series'
import { METRICS } from '@/features/analytics/constants/metrics'
import { CHART_BAR_GAP, groupedBarSize } from '@/features/analytics/lib/chart-bar-size'
import { chartBucketTitle, chartTickLabel } from '@/features/analytics/lib/chart-rows'
import { metricDisplayText } from '@/features/analytics/lib/read-metric'
import { ChartTooltipCard } from '@/shared/components/charts/chart-tooltip-card'
import { ChartContainer, ChartTooltip } from '@/shared/components/ui/chart'

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
  const measure = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = measure.current
    if (!el) {
      return
    }
    const observer = new ResizeObserver(([entry]) => setPlotWidth(entry.contentRect.width))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const label = series.map(key => METRICS[key].label).join(', ')
  const config = Object.fromEntries(series.map(key => [key, { label: METRICS[key].label, color: SERIES_COLORS[key].fill }]))
  const content = ({ active, payload }: TooltipContentProps) => {
    const row: ChartRow | undefined = payload?.[0]?.payload
    if (!active || !row) {
      return null
    }
    const shown = series.map(key => ({ label: METRICS[key].label, value: row.displays[key] ? metricDisplayText(row.displays[key]) : '—', swatch: SERIES_COLORS[key].swatch }))
    return <ChartTooltipCard title={chartBucketTitle(interval, row.key, row.last)} rows={shown} />
  }
  return (
    <div role="img" aria-label={`${label} by ${interval}`} style={{ height }} className={onBucket ? 'cursor-pointer touch-manipulation select-none' : undefined} ref={measure}>
      <ChartContainer className="aspect-auto h-full w-full" config={config}>
        <BarChart
          data={rows}
          syncId="analytics-trend"
          barGap={CHART_BAR_GAP}
          barCategoryGap="20%"
          barSize={groupedBarSize(plotWidth - CHART_MARGIN.left - CHART_MARGIN.right, rows.length, series.length)}
          margin={CHART_MARGIN}
          onClick={(chart) => {
            const index = chart?.activeTooltipIndex == null ? undefined : Number(chart.activeTooltipIndex)
            const row = index !== undefined ? rows[index] : undefined
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
          <ChartTooltip
            active={tooltipActive}
            cursor={{ fill: 'var(--muted)', fillOpacity: 0.6 }}
            content={content}
          />
          {series.map(key => (
            <Bar key={key} dataKey={(row: ChartRow) => row.values[key] ?? null} name={METRICS[key].label} fill={SERIES_COLORS[key].fill} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          ))}
        </BarChart>
      </ChartContainer>
    </div>
  )
}
