'use client'

import type { MeetingListRow } from '@/shared/entities/meetings/dal/server/queries'

import { calendarDayToLocalDate, localDateToCalendarDay } from '@/shared/components/calendar/lib/calendar-helpers'
import { Button } from '@/shared/components/ui/button'
import { Calendar } from '@/shared/components/ui/calendar'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { businessDayKey } from '@/shared/lib/business-time'

import { CalendarMeetingDayButton } from './calendar-meeting-day-button'
import { DashboardDayAgenda } from './dashboard-day-agenda'

interface DashboardMeetingsCalendarProps {
  /** The month grid's live meetings, chronological. */
  rows: MeetingListRow[]
  /** True while `rows` belong to another month or haven't arrived: no dots, and the agenda shows a skeleton. */
  isPending: boolean
  isError: boolean
  onRetry: () => void
  /** Any `YYYY-MM-DD` in the month shown. */
  month: string
  /** Called with the 1st of the month the viewer pages to. */
  onMonthChange: (firstOfMonth: string) => void
  /** `YYYY-MM-DD` the agenda lists; the hub keeps it inside the loaded grid. */
  selectedDay: string
  onSelectDay: (calendarDay: string) => void
}

/** The rows cover the whole month grid (live outcomes only), so the outside days the picker shows get their dots too. */
export function DashboardMeetingsCalendar({ rows, isPending, isError, onRetry, month, onMonthChange, selectedDay, onSelectDay }: DashboardMeetingsCalendarProps) {
  const visibleRows = isPending ? [] : rows
  const daysWithMeetings = new Set(visibleRows.map(row => businessDayKey(new Date(row.scheduledFor))))
  const selectedDayRows = visibleRows.filter(row => businessDayKey(new Date(row.scheduledFor)) === selectedDay)

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <Calendar
        mode="single"
        selected={calendarDayToLocalDate(selectedDay)}
        onSelect={day => day && onSelectDay(localDateToCalendarDay(day))}
        month={calendarDayToLocalDate(month)}
        onMonthChange={next => onMonthChange(`${localDateToCalendarDay(next).slice(0, 7)}-01`)}
        // Cells are local dates and rows are keyed by Pacific day; converting the cell to Pacific would shift it a day east of California.
        modifiers={{ hasMeeting: date => daysWithMeetings.has(localDateToCalendarDay(date)) }}
        components={{ DayButton: CalendarMeetingDayButton }}
        className="w-full p-0 md:w-fit md:shrink-0 md:p-3"
        // WebKit (every iOS browser) sizes this flex column from the grid's pre-stretch
        // width, where the aspect-square cells are smaller, so the grid then overflows
        // onto the agenda. An explicit width makes it measure at its real size.
        classNames={{ root: 'w-full md:w-fit', month_grid: 'w-full md:w-auto' }}
      />
      <div className="min-w-0 flex-1" aria-busy={isPending || undefined}>
        {isError && rows.length === 0
          ? (
              <div role="alert" className="flex flex-col items-start gap-0.5 py-2">
                <p className="text-sm text-muted-foreground">Could not load meetings.</p>
                <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                  Try again
                </Button>
              </div>
            )
          : isPending
            ? <DashboardMeetingsCalendarSkeleton />
            : <DashboardDayAgenda rows={selectedDayRows} selectedDay={calendarDayToLocalDate(selectedDay)} />}
      </div>
    </div>
  )
}

/** Dense card-shaped rows matching the agenda's resting row height while the month's rows load. */
function DashboardMeetingsCalendarSkeleton() {
  return (
    <div className="flex flex-col gap-2 py-2">
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  )
}
