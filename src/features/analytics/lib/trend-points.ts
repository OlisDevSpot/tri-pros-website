import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { MetricDisplay } from '@/features/analytics/lib/read-metric'
import type { AnalyticsReport } from '@/features/analytics/types'

import { formatMonthLabel } from '@/features/analytics/lib/format-analytics'
import { readMetric } from '@/features/analytics/lib/read-metric'

export interface TrendPoint {
  month: string
  label: string
  /** Null draws no bar; the tooltip still says why. */
  value: number | null
  display: MetricDisplay
  selected: boolean
}

export function buildTrendPoints(report: AnalyticsReport, metric: MetricKey): TrendPoint[] {
  return report.trend.map((t) => {
    const display = readMetric(metric, t.row, report.notApplicable.headline)
    return { month: t.month, label: formatMonthLabel(t.month, 'short'), value: display.kind === 'value' ? display.value : null, display, selected: t.selected }
  })
}
