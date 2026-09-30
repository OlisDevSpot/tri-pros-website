'use client'

import type { MeetingListRow } from '@/shared/entities/meetings/dal/server/queries'

import { calendarDayToLocalDate, localDateToCalendarDay } from '@/shared/components/calendar/lib/calendar-helpers'
import { Calendar } from '@/shared/components/ui/calendar'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { SKELETON_BLOCK_TONE_CLASS, SKELETON_FRAME_TONE_CLASS, SKELETON_TONE_CLASS } from '@/shared/constants/skeleton-tone'
import { businessDayKey } from '@/shared/lib/business-time'
import { cn } from '@/shared/lib/utils'

import { CalendarMeetingDayButton } from './calendar-meeting-day-button'
import { DashboardDayAgenda } from './dashboard-day-agenda'

interface DashboardMeetingsCalendarProps {
  /** The month grid's live meetings, chronological. */
  rows: MeetingListRow[]
  /** True while rows belong to another month or haven't arrived (the boundary fallback): no dots, and the agenda shows a skeleton. */
  isPending: boolean
  /** Any `YYYY-MM-DD` in the month shown. */
  month: string
  /** Called with the 1st of the month the viewer pages to. */
  onMonthChange: (firstOfMonth: string) => void
  /** `YYYY-MM-DD` the agenda lists; the hub keeps it inside the loaded grid. */
  selectedDay: string
  onSelectDay: (calendarDay: string) => void
}

/** The rows cover the whole month grid (live outcomes only), so the outside days the picker shows get their dots too. */
export function DashboardMeetingsCalendar({ rows, isPending, month, onMonthChange, selectedDay, onSelectDay }: DashboardMeetingsCalendarProps) {
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
        {isPending
          ? <DashboardMeetingsCalendarSkeleton />
          : <DashboardDayAgenda rows={selectedDayRows} selectedDay={calendarDayToLocalDate(selectedDay)} />}
      </div>
    </div>
  )
}

/** Two of the agenda's rail rows (time badge, hairline, card) at their real 92px, so the swap to the agenda neither jumps nor reflows sideways. */
function DashboardMeetingsCalendarSkeleton() {
  return (
    <div className="flex flex-col">
      {[0, 1].map(i => (
        <div key={i} className="flex items-stretch gap-3">
          <div className="flex w-18 shrink-0 items-center justify-end">
            <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'h-7 w-17')} />
          </div>
          <div className="w-px shrink-0 bg-border" />
          <div className="min-w-0 flex-1 py-2">
            <div className={cn('rounded-lg border bg-card p-2.5', SKELETON_FRAME_TONE_CLASS)}>
              <div className="flex h-6 items-center gap-1.5">
                <Skeleton className={cn(SKELETON_TONE_CLASS, 'size-2 shrink-0 rounded-full')} />
                <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-3 w-28 max-w-full')} />
              </div>
              <div className="mt-1.5 flex h-6 items-center gap-2">
                <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'h-5.5 w-12 shrink-0')} />
                <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'ml-auto size-5 shrink-0 rounded-full')} />
                <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-2.5 w-8')} />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
