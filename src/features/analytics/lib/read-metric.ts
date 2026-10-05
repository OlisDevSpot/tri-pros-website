import type { MetricDefinition, MetricFormat, MetricKey } from '@/features/analytics/constants/metrics'
import type { NotApplicableReasons } from '@/features/analytics/lib/analytics-rules'
import type { AnalyticsReportRow } from '@/features/analytics/types'

import { METRICS } from '@/features/analytics/constants/metrics'
import { formatAsCount, formatAsDollars } from '@/shared/lib/formatters'

export type MetricDisplay
  = | { kind: 'value', value: number, text: string }
    /** A rate or cost over nothing: shown as "—", never 0. */
    | { kind: 'empty' }
    | { kind: 'not_applicable', reason: string }
    | { kind: 'missing' }
    | { kind: 'not_yet', source: string }

export function formatMetricValue(value: number, format: MetricFormat): string {
  switch (format) {
    case 'count':
      return formatAsCount(value)
    case 'money':
      return formatAsDollars(value / 100)
    case 'rate':
      return `${Math.round(value * 100)}%`
    case 'multiple':
      return `${value.toFixed(1)}×`
  }
}

export function readMetric(key: MetricKey, row: AnalyticsReportRow, reasons: NotApplicableReasons): MetricDisplay {
  const definition: MetricDefinition = METRICS[key]
  if ('notYet' in definition) {
    return { kind: 'not_yet', source: definition.notYet }
  }
  if (definition.stage) {
    const rowReason = definition.stage === 'cost' && row.cost.status === 'not_applicable' ? row.cost.reason : undefined
    const reason = reasons[definition.stage] ?? rowReason
    if (reason) {
      return { kind: 'not_applicable', reason }
    }
    if (definition.stage === 'cost' && row.cost.status === 'missing') {
      return { kind: 'missing' }
    }
  }
  const value = definition.read(row)
  return value === null ? { kind: 'empty' } : { kind: 'value', value, text: formatMetricValue(value, definition.format) }
}

/** The one-string form of a display, for places that cannot style it (chart tooltips). */
export function metricDisplayText(display: MetricDisplay): string {
  switch (display.kind) {
    case 'value':
      return display.text
    case 'empty':
      return '—'
    case 'not_applicable':
      return 'n/a'
    case 'missing':
      return 'missing'
    case 'not_yet':
      return 'not available yet'
  }
}

/** Highest first; rows with no value sink to the bottom; ties keep the report's order. */
export function sortRowsByMetric(rows: readonly AnalyticsReportRow[], key: MetricKey, reasons: NotApplicableReasons): AnalyticsReportRow[] {
  const valueOf = (row: AnalyticsReportRow) => {
    const display = readMetric(key, row, reasons)
    return display.kind === 'value' ? display.value : Number.NEGATIVE_INFINITY
  }
  return rows
    .map((row, index) => ({ row, index, value: valueOf(row) }))
    .sort((a, b) => (b.value - a.value) || (a.index - b.index))
    .map(entry => entry.row)
}
