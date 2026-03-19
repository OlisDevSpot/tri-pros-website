import type { CalendarEvent, CalendarViewType } from '@/shared/components/calendar/types'

import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'

const FORMAT_STRING = 'MMM d, yyyy'

export interface CalendarCell {
  day: number
  currentMonth: boolean
  date: Date
}

export function getRangeText(view: CalendarViewType, date: Date): string {
  let start: Date
  let end: Date

  switch (view) {
    case 'month':
      start = startOfMonth(date)
      end = endOfMonth(date)
      break
    case 'week':
      start = startOfWeek(date)
      end = endOfWeek(date)
      break
    default:
      return 'Error while formatting'
  }

  return `${format(start, FORMAT_STRING)} - ${format(end, FORMAT_STRING)}`
}

export function navigateDate(
  date: Date,
  view: CalendarViewType,
  direction: 'previous' | 'next',
): Date {
  const operations: Record<CalendarViewType, (d: Date, n: number) => Date> = {
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

export function groupEvents<T extends CalendarEvent>(dayEvents: T[]): T[][] {
  const sortedEvents = [...dayEvents].sort(
    (a, b) => parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime(),
  )
  const groups: T[][] = []

  for (const event of sortedEvents) {
    const eventStart = parseISO(event.startAt)
    let placed = false

    for (const group of groups) {
      const lastEventInGroup = group[group.length - 1]
      const lastEventEnd = lastEventInGroup.endAt
        ? parseISO(lastEventInGroup.endAt)
        : parseISO(lastEventInGroup.startAt)

      if (eventStart >= lastEventEnd) {
        group.push(event)
        placed = true
        break
      }
    }

    if (!placed) {
      groups.push([event])
    }
  }

  return groups
}

export function getEventBlockStyle<T extends CalendarEvent>(
  event: T,
  day: Date,
  groupIndex: number,
  groupSize: number,
): { top: string, width: string, left: string, height: string } {
  const startDate = parseISO(event.startAt)
  const endDate = event.endAt ? parseISO(event.endAt) : new Date(startDate.getTime() + 60 * 60 * 1000)
  const dayStart = startOfDay(day)
  const eventStart = startDate < dayStart ? dayStart : startDate
  const startMinutes = (eventStart.getTime() - dayStart.getTime()) / 60000
  const durationMinutes = (endDate.getTime() - eventStart.getTime()) / 60000

  const top = (startMinutes / 1440) * 100
  const height = (Math.max(durationMinutes, 15) / 1440) * 100
  const width = 100 / groupSize
  const left = groupIndex * width

  return {
    top: `${top}%`,
    height: `${height}%`,
    width: `${width}%`,
    left: `${left}%`,
  }
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

export function formatHour(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour} ${period}`
}
