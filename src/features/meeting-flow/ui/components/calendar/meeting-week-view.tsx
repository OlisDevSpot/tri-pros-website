'use client'

import type { MeetingCalendarEvent } from '@/features/meeting-flow/types'

import { format, isToday, parseISO } from 'date-fns'
import { useEffect, useMemo, useRef } from 'react'

import { getEventsForDay, getWeekDays } from '@/shared/components/calendar/lib/calendar-helpers'
import { cn } from '@/shared/lib/utils'

const DAY_MIN_WIDTH_PX = 210

interface MeetingWeekViewProps {
  events: MeetingCalendarEvent[]
  currentDate: Date
  hiddenDays: number[]
  renderCard: (event: MeetingCalendarEvent) => React.ReactNode
}

export function MeetingWeekView({
  events,
  currentDate,
  hiddenDays,
  renderCard,
}: MeetingWeekViewProps) {
  const weekDays = useMemo(
    () => getWeekDays(currentDate, hiddenDays),
    [currentDate, hiddenDays],
  )

  const colCount = weekDays.length
  const gridMinWidth = colCount * DAY_MIN_WIDTH_PX
  const scrollRef = useRef<HTMLDivElement>(null)
  const todayColRef = useRef<HTMLDivElement>(null)

  // Scroll today's column into view when currentDate lands on today
  useEffect(() => {
    if (todayColRef.current && scrollRef.current) {
      todayColRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [currentDate])

  return (
    <div ref={scrollRef} className="h-full overflow-x-auto">
      <div className="flex h-full flex-col" style={{ minWidth: `${gridMinWidth}px` }}>
        {/* Day headers */}
        <div
          className="grid shrink-0 border-b bg-background"
          style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
        >
          {weekDays.map(day => (
            <div
              key={day.toISOString()}
              className={cn(
                'py-2 text-center text-xs font-medium text-muted-foreground border-r last:border-r-0',
                isToday(day) && 'bg-primary/10',
              )}
            >
              <span className="block sm:hidden">
                {format(day, 'EEE').charAt(0)}
                <span className={cn('block text-xs font-semibold', isToday(day) ? 'text-foreground' : 'text-foreground')}>
                  {format(day, 'd')}
                </span>
              </span>
              <span className="hidden sm:inline">
                {format(day, 'EE')}
                {' '}
                <span className={cn('ml-1 font-semibold', isToday(day) ? 'text-foreground' : 'text-foreground')}>
                  {format(day, 'd')}
                </span>
              </span>
            </div>
          ))}
        </div>

        {/* Day columns — each independently scrollable on Y overflow */}
        <div
          className="grid min-h-0 flex-1"
          style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
        >
          {weekDays.map((day) => {
            const dayEvents = getEventsForDay(events, day)
            const sorted = [...dayEvents].sort(
              (a, b) => parseISO(a.startAt).getTime() - parseISO(b.startAt).getTime(),
            )

            return (
              <div
                key={day.toISOString()}
                ref={isToday(day) ? todayColRef : undefined}
                className={cn(
                  'flex flex-col gap-1.5 overflow-y-auto border-r p-1.5 last:border-r-0',
                  isToday(day) && 'bg-primary/5',
                )}
              >
                {sorted.length === 0 && (
                  <div className="flex flex-1 items-center justify-center min-h-48">
                    <span className="text-[10px] text-muted-foreground/50">No meetings</span>
                  </div>
                )}
                {sorted.map(event => (
                  <div key={event.id}>
                    {renderCard(event)}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
