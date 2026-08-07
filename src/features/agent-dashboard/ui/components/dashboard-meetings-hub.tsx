'use client'

import { format } from 'date-fns'
import { CalendarCheckIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { businessDayKey, businessToday } from '@/features/agent-dashboard/lib/meeting-windows'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'

import { DashboardMeetingsCalendar } from './dashboard-meetings-calendar'
import { DashboardModule } from './dashboard-module'

/**
 * Meetings module — the dashboard's focal moment. Owns the calendar's month +
 * selected-day state so the header can carry a compact "Today" reset (an icon
 * button beside "See all →") without spending a calendar row on it. Renders the
 * month calendar + day-agenda composition (see ./dashboard-meetings-calendar.tsx),
 * which replaced the earlier Today/Upcoming/Past tabs.
 */
export function DashboardMeetingsHub() {
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date(`${businessToday()}T12:00:00`))
  const [month, setMonth] = useState<Date>(() => new Date(`${businessToday()}T12:00:00`))

  const todayKey = businessToday()
  const isViewingToday
    = businessDayKey(selectedDay) === todayKey
      && format(month, 'yyyy-MM') === todayKey.slice(0, 7)

  return (
    <DashboardModule
      title="Meetings"
      action={(
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Jump to today"
            title="Today"
            disabled={isViewingToday}
            onClick={() => {
              const today = new Date(`${todayKey}T12:00:00`)
              setSelectedDay(today)
              setMonth(today)
            }}
            className="-my-1 size-8 text-muted-foreground hover:text-primary"
          >
            <CalendarCheckIcon className="size-4" />
          </Button>
          <Link
            href={ROOTS.dashboard.meetings.root()}
            className="-my-2 -mr-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent/50 hover:text-primary"
          >
            See all →
          </Link>
        </div>
      )}
    >
      <DashboardMeetingsCalendar
        month={month}
        onMonthChange={setMonth}
        selectedDay={selectedDay}
        onSelectDay={setSelectedDay}
      />
    </DashboardModule>
  )
}
