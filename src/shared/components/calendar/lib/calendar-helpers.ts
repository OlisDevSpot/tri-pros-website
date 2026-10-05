import type { CalendarEvent } from '@/shared/components/calendar/types'
import type { CalendarViewType } from '@/shared/constants/enums'

import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns'

import { businessDayKey, businessToday } from '@/shared/lib/business-time'

const FORMAT_STRING = 'MM/dd/yy'

export interface CalendarCell {
  day: number
  currentMonth: boolean
  date: Date
}

export function getRangeText(view: CalendarViewType, date: Date): string {
  switch (view) {
    case 'today':
      return format(date, 'EEEE, MMM d, yyyy')
    case 'month': {
      const start = startOfMonth(date)
      const end = endOfMonth(date)
      return `${format(start, FORMAT_STRING)} - ${format(end, FORMAT_STRING)}`
    }
    case 'week': {
      const start = startOfWeek(date)
      const end = endOfWeek(date)
      return `${format(start, FORMAT_STRING)} - ${format(end, FORMAT_STRING)}`
    }
  }
}

export function navigateDate(
  date: Date,
  view: CalendarViewType,
  direction: 'previous' | 'next',
): Date {
  const operations: Record<CalendarViewType, (d: Date, n: number) => Date> = {
    today: direction === 'next' ? addDays : subDays,
    month: direction === 'next' ? addMonths : subMonths,
    week: direction === 'next' ? addWeeks : subWeeks,
  }

  return operations[view](date, 1)
}

/** Local noon, so date-fns arithmetic and the grid can't slip a day across a DST change. */
export function calendarDayToLocalDate(calendarDay: string): Date {
  const [year, month, day] = calendarDay.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

export function localDateToCalendarDay(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function getCalendarCells(selectedDate: Date): CalendarCell[] {
  const year = selectedDate.getFullYear()
  const month = selectedDate.getMonth()

  const daysInMonth = endOfMonth(selectedDate).getDate()
  const firstDayOfMonth = startOfMonth(selectedDate).getDay()
  const daysInPrevMonth = endOfMonth(new Date(year, month - 1)).getDate()
  const totalDays = firstDayOfMonth + daysInMonth

  const prevMonthCells = Array.from({ length: firstDayOfMonth }, (_, i) => ({
    day: daysInPrevMonth - firstDayOfMonth + i + 1,
    currentMonth: false,
    date: new Date(year, month - 1, daysInPrevMonth - firstDayOfMonth + i + 1),
  }))

  const currentMonthCells = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    currentMonth: true,
    date: new Date(year, month, i + 1),
  }))

  const nextMonthCells = Array.from(
    { length: (7 - (totalDays % 7)) % 7 },
    (_, i) => ({
      day: i + 1,
      currentMonth: false,
      date: new Date(year, month + 1, i + 1),
    }),
  )

  return [...prevMonthCells, ...currentMonthCells, ...nextMonthCells]
}

export function getWeekDays(date: Date, hiddenDays: number[] = []): Date[] {
  const weekStart = startOfWeek(date)
  const allDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  return allDays.filter(day => !hiddenDays.includes(day.getDay()))
}

export function getEventsForDay<T extends CalendarEvent>(
  events: T[],
  date: Date,
): T[] {
  const calendarDay = localDateToCalendarDay(date)
  return events.filter(event => businessDayKey(new Date(event.startAt)) === calendarDay)
}

/** Grid days are local-noon stand-ins for calendar days; "today" is the business zone's, not the runtime's. */
export function isBusinessToday(date: Date): boolean {
  return localDateToCalendarDay(date) === businessToday()
}

/**
 * The same seed always gives the same integer in `[min, max]`, so a placeholder drawn from a
 * `YYYY-MM-DD` key stays put across re-renders and matches between server and client, where
 * `Math.random` would flicker and break hydration.
 *
 * Precondition: `range.min <= range.max`. Violating it returns NaN or a value outside `[min, max]`.
 */
export function seededIntInRange(seed: string, range: { min: number, max: number }): number {
  // FNV-1a, then murmur3's finalizer: consecutive dates usually differ in their last character
  // alone, and without the finalizer the low bits a modulo reads would just cycle in step with the date.
  let hash = 0x811C9DC5
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 0x01000193)
  }
  hash = Math.imul(hash ^ (hash >>> 16), 0x85EBCA6B)
  hash = Math.imul(hash ^ (hash >>> 13), 0xC2B2AE35)
  hash = (hash ^ (hash >>> 16)) >>> 0
  return range.min + (hash % (range.max - range.min + 1))
}
