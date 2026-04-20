import type { CalendarEvent, CalendarViewType } from '@/shared/components/calendar/types'

import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns'

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

export function getDateRange(
  date: Date,
  view: CalendarViewType,
): { from: Date, to: Date } {
  switch (view) {
    case 'today':
      return { from: startOfDay(date), to: endOfDay(date) }
    case 'month':
      return { from: startOfMonth(date), to: endOfMonth(date) }
    case 'week':
      return { from: startOfWeek(date), to: endOfWeek(date) }
  }
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
  return events.filter((event) => {
    const startDate = parseISO(event.startAt)
    return isSameDay(startDate, date)
  })
}
