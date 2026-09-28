import type { ChartSeriesKey } from '@/features/analytics/constants/chart-series'
import type { AnalyticsInterval } from '@/features/analytics/constants/dimensions'
import type { MetricDisplay } from '@/features/analytics/lib/read-metric'
import type { AnalyticsReport } from '@/features/analytics/types'

import { readMetric } from '@/features/analytics/lib/read-metric'

export interface ChartRow {
  /** The bucket's first day. */
  key: string
  last: string
  /** Null draws no bar; the tooltip still says why. */
  values: Partial<Record<ChartSeriesKey, number | null>>
  displays: Partial<Record<ChartSeriesKey, MetricDisplay>>
}

export function buildChartRows(report: AnalyticsReport, keys: readonly ChartSeriesKey[]): ChartRow[] {
  return report.chart.buckets.map((bucket) => {
    const values: ChartRow['values'] = {}
    const displays: ChartRow['displays'] = {}
    for (const key of keys) {
      const display = readMetric(key, bucket.row, report.notApplicable.headline)
      displays[key] = display
      values[key] = display.kind === 'value' ? display.value : null
    }
    return { key: bucket.first, last: bucket.last, values, displays }
  })
}

function format(day: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })
}

/** Axis labels stay short; the month is named only where it changes. */
export function chartTickLabel(interval: AnalyticsInterval, key: string, previous: string | undefined): string {
  if (interval === 'month') {
    return key.slice(5, 7) === '01' || !previous ? format(key, { month: 'short', year: '2-digit' }) : format(key, { month: 'short' })
  }
  if (interval === 'day' && previous && previous.slice(0, 7) === key.slice(0, 7)) {
    return String(Number(key.slice(8)))
  }
  return format(key, { month: 'short', day: 'numeric' })
}

export function chartBucketTitle(interval: AnalyticsInterval, first: string, last: string): string {
  if (interval === 'day') {
    return format(first, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }
  if (interval === 'month') {
    return format(first, { month: 'long', year: 'numeric' })
  }
  return first === last ? format(first, { month: 'short', day: 'numeric' }) : `${format(first, { month: 'short', day: 'numeric' })} – ${format(last, { month: 'short', day: 'numeric' })}`
}

/** About `steps` round steps from zero, so the fixed axis and the scrolling plot share one scale. Counts step in whole numbers. */
export function niceTicks(max: number, whole: boolean, steps = 4): number[] {
  if (max <= 0) {
    return [0, 1]
  }
  const raw = max / steps
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const candidates = [1, 2, 2.5, 5, 10].map(m => m * magnitude).filter(s => !whole || Number.isInteger(s))
  const step = Math.max(candidates.find(s => s >= raw) ?? raw, whole ? 1 : 0)
  const ticks = [0]
  while (ticks[ticks.length - 1] < max) {
    ticks.push(ticks[ticks.length - 1] + step)
  }
  return ticks
}
