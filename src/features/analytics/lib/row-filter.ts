import type { AnalyticsUrlState, FilterKey } from '@/features/analytics/constants/query-parsers'
import type { AnalyticsGroupBy } from '@/features/analytics/types'

import { UNKNOWN_FILTER_VALUE } from '@/features/analytics/constants/dimensions'
import { lastDayOfMonth } from '@/features/analytics/lib/analytics-periods'
import { filterUpdate } from '@/features/analytics/lib/filter-update'

// Which filter a breakdown row narrows to; the key is the row's own value, so the report's labels still apply.
const ROW_FILTER: Partial<Record<AnalyticsGroupBy, { key: FilterKey, unknown: boolean }>> = {
  leadSource: { key: 'source', unknown: true },
  city: { key: 'city', unknown: true },
  zip: { key: 'zip', unknown: true },
  closer: { key: 'closer', unknown: false },
  outcome: { key: 'outcome', unknown: false },
  meetingOrder: { key: 'order', unknown: false },
}

export interface RowFilter {
  /** Already narrowed to this row: clicking again removes it. */
  active: boolean
  update: Partial<AnalyticsUrlState>
}

/** The URL change a click on a breakdown row makes, or null when the row cannot narrow anything (an unassigned closer, an undated month, the month already shown). */
export function rowFilter(groupBy: AnalyticsGroupBy, groupKey: string | null, state: AnalyticsUrlState): RowFilter | null {
  if (groupBy === 'month') {
    if (groupKey === null) {
      return null
    }
    const first = `${groupKey}-01`
    const last = lastDayOfMonth(groupKey)
    // Already the timeframe: there is nothing to narrow, and no earlier period to go back to.
    if (state.period === 'custom' && state.from === first && state.to === last) {
      return null
    }
    return { active: false, update: { period: 'custom', from: first, to: last, interval: null } }
  }
  const target = ROW_FILTER[groupBy]
  if (!target || (groupKey === null && !target.unknown)) {
    return null
  }
  const value = groupKey ?? UNKNOWN_FILTER_VALUE
  const current: readonly string[] = state[target.key]
  const active = current.includes(value)
  return { active, update: filterUpdate(target.key, active ? current.filter(v => v !== value) : [...current, value]) }
}
