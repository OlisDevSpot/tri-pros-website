'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'

import { meetingsMonthInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { businessDayKey } from '@/features/agent-dashboard/lib/meeting-windows'
import { Calendar } from '@/shared/components/ui/calendar'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

import { CalendarMeetingDayButton } from './calendar-meeting-day-button'
import { DashboardDayAgenda } from './dashboard-day-agenda'

interface DashboardMeetingsCalendarProps {
  /** The visible month (controlled by the hub so its header Today control can reset it). */
  month: Date
  onMonthChange: (month: Date) => void
  /** The day whose meetings the agenda lists (controlled by the hub). */
  selectedDay: Date
  onSelectDay: (day: Date) => void
}

/**
 * Meetings calendar — a month `<Calendar>` (left) whose cells carry a
 * cobalt dot on any day with ≥1 live meeting (`CalendarMeetingDayButton`),
 * paired with a `<DashboardDayAgenda>` (right) listing the selected day's
 * meetings chronologically. Replaces the old Today/Upcoming/Past tabs: one
 * `meetingsRouter.reads.list` query per visible month (`meetingsMonthInput`,
 * capped/sorted server-side), sliced client-side by LA calendar day.
 * `placeholderData: keepPreviousData` keeps the current month's rows on
 * screen while paging to a new month, instead of flashing to a skeleton.
 *
 * Month + selected-day state is lifted to `DashboardMeetingsHub` so the
 * module header's "Today" control (beside "See all →") can reset both without
 * spending a calendar row on its own button.
 */
export function DashboardMeetingsCalendar({ month, onMonthChange, selectedDay, onSelectDay }: DashboardMeetingsCalendarProps) {
  const trpc = useTRPC()

  const anchor = format(month, 'yyyy-MM-dd')
  const { data, isLoading } = useQuery(
    trpc.meetingsRouter.reads.list.queryOptions(meetingsMonthInput(anchor), { placeholderData: keepPreviousData }),
  )

  const rows = data?.rows ?? []
  const daysWithMeetings = new Set(rows.map(row => businessDayKey(new Date(row.scheduledFor))))
  const selectedDayKey = businessDayKey(selectedDay)
  const selectedDayRows = rows.filter(row => businessDayKey(new Date(row.scheduledFor)) === selectedDayKey)

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <Calendar
        mode="single"
        selected={selectedDay}
        onSelect={day => day && onSelectDay(day)}
        month={month}
        onMonthChange={onMonthChange}
        modifiers={{ hasMeeting: date => daysWithMeetings.has(businessDayKey(date)) }}
        components={{ DayButton: CalendarMeetingDayButton }}
        className="w-full p-0 md:w-fit md:shrink-0 md:p-3"
        classNames={{ root: 'w-full md:w-fit' }}
      />
      <div className="min-w-0 flex-1">
        {isLoading
          ? <DashboardMeetingsCalendarSkeleton />
          : <DashboardDayAgenda rows={selectedDayRows} selectedDay={selectedDay} />}
      </div>
    </div>
  )
}

/** Dense card-shaped rows matching the agenda's resting row height while the month query is in flight. */
function DashboardMeetingsCalendarSkeleton() {
  return (
    <div className="flex flex-col gap-2 py-2">
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  )
}
