'use client'

import type { DayButton } from 'react-day-picker'

import * as React from 'react'

import { CalendarDayButton } from '@/shared/components/ui/calendar'
import { cn } from '@/shared/lib/utils'

/**
 * `DayButton` replacement for the meetings calendar: renders the shared
 * `CalendarDayButton` unchanged (day number, selected/today styling all
 * flow through untouched via `children`), then adds a small cobalt dot
 * `<span>` inside the button, absolutely centered beneath the date number,
 * whenever `modifiers.hasMeeting` is set (the calendar's day-cell modifier
 * marking a day with ≥1 scheduled meeting).
 */
export function CalendarMeetingDayButton({ className, day, modifiers, children, ...props }: React.ComponentProps<typeof DayButton>) {
  return (
    <CalendarDayButton
      day={day}
      modifiers={modifiers}
      className={cn('relative', className)}
      {...props}
    >
      {children}
      {modifiers.hasMeeting && (
        <span
          aria-hidden="true"
          className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary"
        />
      )}
    </CalendarDayButton>
  )
}
