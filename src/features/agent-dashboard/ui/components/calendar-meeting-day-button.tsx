'use client'

import type { DayButton } from 'react-day-picker'

import * as React from 'react'

import { CalendarDayButton } from '@/shared/components/ui/calendar'
import { cn } from '@/shared/lib/utils'

/**
 * `DayButton` replacement for the meetings calendar: renders the shared
 * `CalendarDayButton` unchanged (day number, selected/today styling all
 * flow through untouched via `children`), then adds a small cobalt dot
 * inside the button, absolutely centered beneath the date number, whenever
 * `modifiers.hasMeeting` is set (the calendar's day-cell modifier marking a
 * day with ≥1 scheduled meeting). `CalendarDayButton`'s className includes
 * `[&>span]:opacity-70` (styling the day-number span), which would fade the
 * dot too if it were a `<span>` — so the dot is a `<div>` instead, which the
 * `[&>span]` selector can't match, keeping it solid cobalt. A visually-hidden
 * "has meetings" label surfaces the same signal to screen readers, since the
 * dot itself is `aria-hidden`.
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
        <>
          <div
            aria-hidden="true"
            className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary"
          />
          <span className="sr-only">has meetings</span>
        </>
      )}
    </CalendarDayButton>
  )
}
