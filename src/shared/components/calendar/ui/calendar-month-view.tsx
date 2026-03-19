'use client'

import type { CalendarEvent } from '@/shared/components/calendar/types'

import { isToday } from 'date-fns'
import { useMemo } from 'react'

import { getCalendarCells, getEventsForDay } from '@/shared/components/calendar/lib/calendar-helpers'
import { cn } from '@/shared/lib/utils'

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MAX_VISIBLE_EVENTS = 3

interface Props<T extends CalendarEvent> {
  events: T[]
  currentDate: Date
  renderCompact: (event: T) => React.ReactNode
  onEventClick?: (event: T) => void
}

export function CalendarMonthView<T extends CalendarEvent>({
  events,
  currentDate,
  renderCompact,
  onEventClick,
}: Props<T>) {
  const cells = useMemo(() => getCalendarCells(currentDate), [currentDate])

  return (
    <div>
      {/* Day-of-week header */}
      <div className="grid grid-cols-7">
        {WEEK_DAYS.map(day => (
          <div
            key={day}
            className="flex items-center justify-center py-2"
          >
            <span className="text-xs font-medium text-muted-foreground">{day}</span>
          </div>
        ))}
      </div>

      {/* Calendar cells */}
      <div className="grid grid-cols-7 overflow-hidden">
        {cells.map((cell) => {
          const dayEvents = getEventsForDay(events, cell.date)
          const overflowCount = dayEvents.length - MAX_VISIBLE_EVENTS
          const isSunday = cell.date.getDay() === 0

          return (
            <div
              key={cell.date.toISOString()}
              className={cn(
                'flex min-h-28 flex-col gap-1 border-l border-t p-1 lg:min-h-32',
                isSunday && 'border-l-0',
              )}
            >
              {/* Day number */}
              <span
                className={cn(
                  'h-6 px-1 text-xs font-semibold',
                  !cell.currentMonth && 'opacity-30',
                  isToday(cell.date) && 'flex w-6 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground',
                )}
              >
                {cell.day}
              </span>

              {/* Events */}
              <div
                className={cn(
                  'flex flex-col gap-0.5',
                  !cell.currentMonth && 'opacity-50',
                )}
              >
                {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map(event => (
                  <button
                    key={event.id}
                    type="button"
                    className="w-full cursor-pointer text-left"
                    onClick={() => onEventClick?.(event)}
                  >
                    {renderCompact(event)}
                  </button>
                ))}

                {overflowCount > 0 && cell.currentMonth && (
                  <span className="px-1 text-xs font-semibold text-muted-foreground">
                    +
                    {overflowCount}
                    {' '}
                    more
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
