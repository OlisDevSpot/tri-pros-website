import type { AnalyticsPeriod } from '@/features/analytics/types'

import { addCalendarDays, BUSINESS_TIMEZONE, businessDayKey, startOfDayInTimeZone } from '@/shared/lib/business-time'

export interface ResolvedPeriod {
  /** First and last business day, both inclusive. */
  firstDay: string
  lastDay: string
  /** The same days as instants, `to` exclusive — the aggregator's range. */
  range: { from: string, to: string }
}

export function addMonths(monthKey: string, months: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 7)
}

export function lastDayOfMonth(monthKey: string): string {
  return addCalendarDays(`${addMonths(monthKey, 1)}-01`, -1)
}

/** Every month from `first` to `last`, both inclusive. */
export function monthsBetween(first: string, last: string): string[] {
  const months: string[] = []
  for (let month = first; month <= last; month = addMonths(month, 1)) {
    months.push(month)
  }
  return months
}

function quarterStart(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return `${year}-${String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, '0')}`
}

function periodDays(input: { period: AnalyticsPeriod, from?: string, to?: string }, today: string): [string, string] {
  const thisMonth = today.slice(0, 7)
  switch (input.period) {
    case 'this-month':
      return [`${thisMonth}-01`, lastDayOfMonth(thisMonth)]
    case 'last-month': {
      const month = addMonths(thisMonth, -1)
      return [`${month}-01`, lastDayOfMonth(month)]
    }
    case 'this-quarter': {
      const start = quarterStart(thisMonth)
      return [`${start}-01`, lastDayOfMonth(addMonths(start, 2))]
    }
    case 'last-quarter': {
      const start = addMonths(quarterStart(thisMonth), -3)
      return [`${start}-01`, lastDayOfMonth(addMonths(start, 2))]
    }
    case 'ytd':
      return [`${today.slice(0, 4)}-01-01`, today]
    case 'last-12':
      return [`${addMonths(thisMonth, -11)}-01`, lastDayOfMonth(thisMonth)]
    case 'custom':
      if (!input.from || !input.to) {
        throw new Error('A custom period needs a first and a last day.')
      }
      return [input.from, input.to]
  }
}

/**
 * Periods are whole Pacific business days. A "this" period runs to its
 * calendar end and its data simply stops at today; year to date stops at today.
 */
export function resolveAnalyticsPeriod(input: { period: AnalyticsPeriod, from?: string, to?: string }, now: Date): ResolvedPeriod {
  const [firstDay, lastDay] = periodDays(input, businessDayKey(now))
  return {
    firstDay,
    lastDay,
    range: {
      from: startOfDayInTimeZone(firstDay, BUSINESS_TIMEZONE).toISOString(),
      to: startOfDayInTimeZone(addCalendarDays(lastDay, 1), BUSINESS_TIMEZONE).toISOString(),
    },
  }
}
