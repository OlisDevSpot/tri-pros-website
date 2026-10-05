'use client'

import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { resolveAnalyticsPeriod } from '@/features/analytics/lib/analytics-periods'
import { formatDayRange } from '@/features/analytics/lib/format-analytics'
import { toReportInput } from '@/features/analytics/lib/to-report-input'

/** The period's days, resolved from the URL rather than the report, so the server and the first client render agree. */
export function useAnalyticsRange() {
  const [state] = useAnalyticsUrlState()
  const { firstDay, lastDay } = resolveAnalyticsPeriod(toReportInput(state), new Date())
  return { firstDay, lastDay, label: formatDayRange(firstDay, lastDay) }
}
