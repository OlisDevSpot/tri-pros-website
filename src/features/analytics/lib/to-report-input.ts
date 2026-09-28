import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { AnalyticsUrlState } from '@/features/analytics/constants/query-parsers'
import type { ReportTab } from '@/features/analytics/constants/tabs'
import type { AnalyticsReportInput } from '@/features/analytics/schemas/report-input-schema'
import type { AnalyticsFilters, AnalyticsGroupBy } from '@/features/analytics/types'

import z from 'zod'

import { UNKNOWN_FILTER_VALUE } from '@/features/analytics/constants/dimensions'
import { METRICS } from '@/features/analytics/constants/metrics'
import { isReportTab, REPORT_TABS } from '@/features/analytics/constants/tabs'
import { businessDaySchema } from '@/features/analytics/schemas/report-input-schema'

// The router's own check, so a source id that passes here never fails the request.
const sourceIdSchema = z.string().uuid()

function withUnknown(values: readonly string[]): (string | null)[] {
  return values.map(v => (v === UNKNOWN_FILTER_VALUE ? null : v))
}

/** A group-by the tab does not offer (a stale URL) falls back to the tab's first. */
export function resolveGroupBy(state: Pick<AnalyticsUrlState, 'tab' | 'groupBy'>): Exclude<AnalyticsGroupBy, 'total'> {
  const { groupBys } = REPORT_TABS[isReportTab(state.tab) ? state.tab : 'overview']
  return groupBys.find(g => g === state.groupBy) ?? groupBys[0]
}

/** Only a figure on the tab with a value can be the focus; anything else falls back to the tab's default. */
export function resolveFocus(tab: ReportTab, focus: string | null): MetricKey {
  const config = REPORT_TABS[tab]
  const focusable = config.figures.map(f => f.metric).filter(key => !('notYet' in METRICS[key]))
  return focusable.find(key => key === focus) ?? config.defaultFocus
}

/**
 * The one mapping from URL state to the report input, shared by the page's
 * prefetch and the view so both ask for the same query key. A malformed URL
 * falls back to a valid report instead of a failed request.
 */
export function toReportInput(state: AnalyticsUrlState): AnalyticsReportInput {
  const customOk = state.period === 'custom'
    && businessDaySchema.safeParse(state.from).success
    && businessDaySchema.safeParse(state.to).success
    && state.from <= state.to
  const period = state.period === 'custom' && !customOk ? 'this-month' : state.period

  const filters: AnalyticsFilters = {}
  const sources = state.source.filter(v => v === UNKNOWN_FILTER_VALUE || sourceIdSchema.safeParse(v).success)
  if (sources.length > 0) {
    filters.leadSourceIds = withUnknown(sources)
  }
  if (state.city.length > 0) {
    filters.cities = withUnknown(state.city)
  }
  if (state.zip.length > 0) {
    filters.zips = withUnknown(state.zip)
  }
  if (state.closer.length > 0) {
    filters.closerIds = [...state.closer]
  }
  if (state.outcome.length > 0) {
    filters.outcomes = [...state.outcome]
  }
  if (state.order.length > 0) {
    filters.meetingOrder = [...state.order]
  }

  return {
    period,
    ...(period === 'custom' ? { from: state.from, to: state.to } : {}),
    filters,
    groupBy: resolveGroupBy(state),
  }
}
