import type { FilterKey } from '@/features/analytics/constants/query-parsers'
import type { AnalyticsGroupBy } from '@/features/analytics/types'

import { MEETING_ORDERS, UNKNOWN_FILTER_VALUE } from '@/features/analytics/constants/dimensions'
import { MEETING_ORDER_LABELS } from '@/features/analytics/constants/labels'
import { meetingOutcomes } from '@/shared/constants/enums/meetings'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'

export interface AnalyticsNames {
  sourceName: (id: string) => string
  closerName: (id: string) => string
}

function formatDay(day: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })
}

export function formatMonthLabel(month: string, style: 'long' | 'short' = 'long'): string {
  return formatDay(`${month}-01`, style === 'long' ? { month: 'short', year: 'numeric' } : { month: 'short' })
}

export function formatDayRange(first: string, last: string): string {
  const year = last.slice(0, 4)
  if (first.slice(0, 7) === last.slice(0, 7)) {
    return `${formatDay(first, { month: 'short', day: 'numeric' })} – ${Number(last.slice(8))}, ${year}`
  }
  if (first.slice(0, 4) === year) {
    return `${formatDay(first, { month: 'short', day: 'numeric' })} – ${formatDay(last, { month: 'short', day: 'numeric' })}, ${year}`
  }
  const withYear: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  return `${formatDay(first, withYear)} – ${formatDay(last, withYear)}`
}

function outcomeLabel(value: string): string {
  const outcome = meetingOutcomes.find(o => o === value)
  return outcome ? MEETING_OUTCOME_LABELS[outcome] : value
}

function meetingOrderLabel(value: string): string {
  const order = MEETING_ORDERS.find(o => o === value)
  return order ? MEETING_ORDER_LABELS[order] : value
}

export function groupLabel(groupBy: AnalyticsGroupBy, key: string | null, names: AnalyticsNames): string {
  switch (groupBy) {
    case 'total':
      return 'Total'
    case 'leadSource':
      return key === null ? 'Unknown source' : names.sourceName(key)
    case 'month':
      return key === null ? 'Undated' : formatMonthLabel(key)
    case 'closer':
      return key === null ? 'Unassigned' : names.closerName(key)
    case 'outcome':
      return key === null ? 'Unknown' : outcomeLabel(key)
    case 'meetingOrder':
      return key === null ? 'Unknown' : meetingOrderLabel(key)
    case 'city':
      return key ?? 'Unknown city'
    case 'zip':
      return key ?? 'Unknown zip'
  }
}

export function filterValueLabel(key: FilterKey, value: string, names: AnalyticsNames): string {
  const unknown = value === UNKNOWN_FILTER_VALUE
  switch (key) {
    case 'source':
      return unknown ? 'Unknown source' : names.sourceName(value)
    case 'city':
      return unknown ? 'Unknown city' : value
    case 'zip':
      return unknown ? 'Unknown zip' : `Zip ${value}`
    case 'closer':
      return names.closerName(value)
    case 'outcome':
      return outcomeLabel(value)
    case 'order':
      return meetingOrderLabel(value)
  }
}
