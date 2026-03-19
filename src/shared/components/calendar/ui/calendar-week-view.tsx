'use client'

import type { CalendarEvent } from '@/shared/components/calendar/types'

import { format, isToday, parseISO } from 'date-fns'
import { useMemo } from 'react'

import {
  formatHour,
  getEventBlockStyle,
  getEventsForDay,
  getWeekDays,
  groupEvents,
} from '@/shared/components/calendar/lib/calendar-helpers'
import { CalendarTimeIndicator } from '@/shared/components/calendar/ui/calendar-time-indicator'
import { ScrollArea } from '@/shared/components/ui/scroll-area'

const START_HOUR = 8
const END_HOUR = 22
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR)
const HOUR_HEIGHT_PX = 156
const DAY_MIN_WIDTH_PX = 150

interface Props<T extends CalendarEvent> {
  events: T[]
  currentDate: Date
  hiddenDays: number[]
  renderCard: (event: T) => React.ReactNode
  onEventClick?: (event: T) => void
}

export function CalendarWeekView<T extends CalendarEvent>({
  events,
  currentDate,
  hiddenDays,
  renderCard,
  onEventClick: _onEventClick,
}: Props<T>) {
  const weekDays = useMemo(
    () => getWeekDays(currentDate, hiddenDays),
    [currentDate, hiddenDays],
  )

  const colCount = weekDays.length
  const gridMinWidth = colCount * DAY_MIN_WIDTH_PX

  return (
    <div className="flex h-full flex-col">
      {/* Week header — hours label is fixed, days scroll */}
      <div className="flex border-b">
        <div className="w-16 shrink-0 bg-background" />
        <div className="flex-1 overflow-x-auto">
          <div
            className="grid border-l"
            style={{
              gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
              minWidth: `${gridMinWidth}px`,
            }}
          >
            {weekDays.map(day => (
              <div
                key={day.toISOString()}
                className="py-2 text-center text-xs font-medium text-muted-foreground"
              >
                <span className="block sm:hidden">
                  {format(day, 'EEE').charAt(0)}
                  <span className="block text-xs font-semibold text-foreground">
                    {format(day, 'd')}
                  </span>
                </span>
                <span className="hidden sm:inline">
                  {format(day, 'EE')}
                  {' '}
                  <span
                    className={
                      isToday(day)
                        ? 'ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground'
                        : 'ml-1 font-semibold text-foreground'
                    }
                  >
                    {format(day, 'd')}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Time grid — hours column is fixed, day columns scroll */}
      <ScrollArea className="h-175" type="always">
        <div className="flex">
          {/* Hours column — always visible */}
          <div className="sticky left-0 z-20 w-16 shrink-0 bg-background">
            {HOURS.map((hour, index) => (
              <div
                key={hour}
                className="relative"
                style={{ height: `${HOUR_HEIGHT_PX}px` }}
              >
                {index !== 0 && (
                  <div className="absolute -top-3 right-2 flex h-6 items-center">
                    <span className="text-xs text-muted-foreground">
                      {formatHour(hour)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Week grid — scrolls horizontally */}
          <div className="relative flex-1 border-l" style={{ minWidth: `${gridMinWidth}px` }}>
            <div
              className="grid divide-x"
              style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
            >
              {weekDays.map((day) => {
                const dayEvents = getEventsForDay(events, day)
                const groupedEvents = groupEvents(dayEvents)

                return (
                  <WeekDayColumn
                    key={day.toISOString()}
                    day={day}
                    groupedEvents={groupedEvents}
                    renderCard={renderCard}
                  />
                )
              })}
            </div>

            <CalendarTimeIndicator startHour={START_HOUR} endHour={END_HOUR} />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

interface WeekDayColumnProps<T extends CalendarEvent> {
  day: Date
  groupedEvents: T[][]
  renderCard: (event: T) => React.ReactNode
  onEventClick?: (event: T) => void
}

function WeekDayColumn<T extends CalendarEvent>({
  day,
  groupedEvents,
  renderCard,
  onEventClick: _onEventClick,
}: WeekDayColumnProps<T>) {
  const todayHighlight = isToday(day) ? 'bg-primary/5' : ''

  return (
    <div className={`relative ${todayHighlight}`}>
      {/* Hour cells with grid lines */}
      {HOURS.map((hour, index) => (
        <div
          key={hour}
          className="relative"
          style={{ height: `${HOUR_HEIGHT_PX}px` }}
        >
          {index !== 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-0 border-b" />
          )}
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-b border-dashed opacity-30" />
        </div>
      ))}

      {/* Event blocks */}
      {groupedEvents.map((group, groupIndex) =>
        group.map((event) => {
          const style = getEventBlockStyle(
            event,
            day,
            groupIndex,
            groupedEvents.length,
            START_HOUR,
            END_HOUR,
          )

          const hasOverlap = groupedEvents.length > 1
            && groupedEvents.some(
              (otherGroup, otherIndex) =>
                otherIndex !== groupIndex
                && otherGroup.some((otherEvent) => {
                  const eventStart = parseISO(event.startAt)
                  const eventEnd = event.endAt
                    ? parseISO(event.endAt)
                    : new Date(eventStart.getTime() + 60 * 60 * 1000)
                  const otherStart = parseISO(otherEvent.startAt)
                  const otherEnd = otherEvent.endAt
                    ? parseISO(otherEvent.endAt)
                    : new Date(otherStart.getTime() + 60 * 60 * 1000)
                  return eventStart < otherEnd && eventEnd > otherStart
                }),
            )

          const finalStyle = hasOverlap
            ? style
            : { ...style, width: '100%', left: '0%' }

          return (
            <div
              key={event.id}
              className="absolute p-0.5"
              style={finalStyle}
            >
              <div className="h-full w-full">
                {renderCard(event)}
              </div>
            </div>
          )
        }),
      )}
    </div>
  )
}
