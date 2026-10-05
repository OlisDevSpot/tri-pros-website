import type { AnalyticsInterval } from '@/features/analytics/constants/dimensions'
import type { DayRange } from '@/features/analytics/lib/analytics-rules'

import { ANALYTICS_INTERVALS } from '@/features/analytics/constants/dimensions'
import { lastDayOfMonth } from '@/features/analytics/lib/analytics-periods'
import { addCalendarDays } from '@/shared/lib/business-time'

// Past these, a day or week chart is a smear of slivers even when it scrolls.
const MAX_DAY_BUCKETS = 186
const MAX_WEEK_BUCKETS = 160

function dayCount(range: DayRange): number {
  return Math.round((Date.parse(`${range.last}T00:00:00Z`) - Date.parse(`${range.first}T00:00:00Z`)) / 86_400_000) + 1
}

/** Weeks start on Monday; the first and last weeks are clipped to the period. */
function weekStart(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
  return addCalendarDays(day, -((weekday + 6) % 7))
}

export function chartBuckets(range: DayRange, interval: AnalyticsInterval): DayRange[] {
  const buckets: DayRange[] = []
  let first = range.first
  while (first <= range.last) {
    let end: string
    if (interval === 'day') {
      end = first
    }
    else if (interval === 'week') {
      end = addCalendarDays(weekStart(first), 6)
    }
    else {
      end = lastDayOfMonth(first.slice(0, 7))
    }
    const last = end < range.last ? end : range.last
    buckets.push({ first, last })
    first = addCalendarDays(last, 1)
  }
  return buckets
}

/** Intervals that give the period at least two bars and no more than a readable scroll. */
export function chartIntervals(range: DayRange): AnalyticsInterval[] {
  const days = dayCount(range)
  return ANALYTICS_INTERVALS.filter((interval) => {
    if (interval === 'day') {
      return days >= 2 && days <= MAX_DAY_BUCKETS
    }
    if (interval === 'week') {
      return days >= 8 && days <= MAX_WEEK_BUCKETS * 7
    }
    return range.first.slice(0, 7) !== range.last.slice(0, 7)
  })
}

/** Short periods read best by day, a quarter or so by week, anything longer by month. */
export function resolveChartInterval(range: DayRange, requested: AnalyticsInterval | undefined): AnalyticsInterval {
  const offered = chartIntervals(range)
  if (requested && offered.includes(requested)) {
    return requested
  }
  const days = dayCount(range)
  const preferred: AnalyticsInterval = days <= 62 ? 'day' : days <= 186 ? 'week' : 'month'
  return offered.includes(preferred) ? preferred : (offered[0] ?? 'day')
}
