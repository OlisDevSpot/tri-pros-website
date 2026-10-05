import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { ReportTabConfig } from '@/features/analytics/constants/tabs'

import { METRICS } from '@/features/analytics/constants/metrics'

/** A tab's own column list, or its headline figures with their sub-figures; a figure not available yet has no column. */
export function breakdownColumns(config: ReportTabConfig): MetricKey[] {
  const keys = config.columns ?? config.figures.flatMap(f => (f.sub ? [f.metric, f.sub] : [f.metric]))
  return keys.filter(key => !('notYet' in METRICS[key]))
}
