'use client'

import type { CalendarEvent } from '@/shared/components/calendar/types'

import { isToday } from 'date-fns'
import { useMemo } from 'react'

import { getCalendarCells, getEventsForDay, localDateToCalendarDay, seededIntInRange } from '@/shared/components/calendar/lib/calendar-helpers'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { SKELETON_TONE_CLASS } from '@/shared/constants/skeleton-tone'
import { cn } from '@/shared/lib/utils'

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
const MAX_VISIBLE_EVENTS = 3

interface Props<T extends CalendarEvent> {
  events: T[]
  currentDate: Date
  /** While a window loads, each cell shows 1–`MAX_VISIBLE_EVENTS` skeleton lines, seeded by its date, in place of its events. */
  isPending?: boolean
  renderCompact: (event: T) => React.ReactNode
  onEventClick?: (event: T) => void
}

export function CalendarMonthView<T extends CalendarEvent>({
  events,
  currentDate,
  isPending = false,
  renderCompact,
  onEventClick: _onEventClick,
}: Props<T>) {
  const cells = useMemo(() => getCalendarCells(currentDate), [currentDate])

  return (
    <div aria-busy={isPending || undefined}>
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
          const skeletonCount = seededIntInRange(localDateToCalendarDay(cell.date), { min: 1, max: MAX_VISIBLE_EVENTS })

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
                {isPending
                  ? Array.from({ length: skeletonCount }).map((_, i) => (
                      // A compact event row is 20px of 12px text: a slab the row's full height reads as a block, not a line.
                      // eslint-disable-next-line react/no-array-index-key
                      <div key={i} className="flex h-5 items-center px-1">
                        <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-2.5 w-full')} />
                      </div>
                    ))
                  : (
                      <>
                        {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map(event => (
                          <div key={event.id} className="w-full text-left">
                            {renderCompact(event)}
                          </div>
                        ))}

                        {overflowCount > 0 && cell.currentMonth && (
                          <span className="px-1 text-xs font-semibold text-muted-foreground">
                            +
                            {overflowCount}
                            {' '}
                            more
                          </span>
                        )}
                      </>
                    )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
