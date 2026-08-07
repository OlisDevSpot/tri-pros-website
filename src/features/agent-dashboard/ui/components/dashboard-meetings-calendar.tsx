'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useState } from 'react'

import { meetingsMonthInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { businessToday } from '@/features/agent-dashboard/lib/meeting-windows'
import { Calendar } from '@/shared/components/ui/calendar'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

import { CalendarMeetingDayButton } from './calendar-meeting-day-button'
import { DashboardDayAgenda } from './dashboard-day-agenda'

/**
 * `YYYY-MM-DD` calendar-day key for `date` in the business timezone
 * (America/Los_Angeles) — the SAME derivation used both for grouping
 * meeting rows (`daysWithMeetings` / `selectedDayRows`) and for the
 * calendar's per-cell `hasMeeting` modifier, so the two can never disagree
 * about which day an instant falls on. A raw local `.toDateString()` /
 * `.getDate()` here would reintroduce the server/client timezone mismatch
 * this whole feature guards against (see ../lib/meeting-windows.ts).
 */
function laDayKey(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
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
 */
export function DashboardMeetingsCalendar() {
  const trpc = useTRPC()
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date(`${businessToday()}T12:00:00`))
  const [month, setMonth] = useState<Date>(() => new Date(`${businessToday()}T12:00:00`))

  const anchor = format(month, 'yyyy-MM-dd')
  const { data, isLoading } = useQuery(
    trpc.meetingsRouter.reads.list.queryOptions(meetingsMonthInput(anchor), { placeholderData: keepPreviousData }),
  )

  const rows = data?.rows ?? []
  const daysWithMeetings = new Set(rows.map(row => laDayKey(new Date(row.scheduledFor))))
  const selectedDayKey = laDayKey(selectedDay)
  const selectedDayRows = rows.filter(row => laDayKey(new Date(row.scheduledFor)) === selectedDayKey)

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <Calendar
        mode="single"
        selected={selectedDay}
        onSelect={day => day && setSelectedDay(day)}
        month={month}
        onMonthChange={setMonth}
        modifiers={{ hasMeeting: date => daysWithMeetings.has(laDayKey(date)) }}
        components={{ DayButton: CalendarMeetingDayButton }}
        className="md:w-fit shrink-0"
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
