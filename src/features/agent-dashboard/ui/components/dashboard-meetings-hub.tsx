'use client'

import { CalendarCheckIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { DASHBOARD_MEETINGS_EXTRA, DASHBOARD_MEETINGS_QUERY } from '@/features/agent-dashboard/constants/dashboard-queries'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { businessDayKey, businessToday } from '@/shared/lib/business-time'
import { useTRPC } from '@/trpc/helpers'

import { DashboardMeetingsCalendar } from './dashboard-meetings-calendar'
import { DashboardModule } from './dashboard-module'

/**
 * Meetings module — the dashboard's focal moment. Owns the calendar's read (month in the URL as `dm_d`, so Back
 * steps months) and the picked day, so the header can carry a compact "Today" reset (an icon button beside
 * "See all →") without spending a calendar row on it.
 */
export function DashboardMeetingsHub() {
  const trpc = useTRPC()
  const query = useDataViewQuery(trpc.meetingsRouter.reads.list, DASHBOARD_MEETINGS_EXTRA, DASHBOARD_MEETINGS_QUERY)
  const { anchor, range, isPending, setAnchor } = query.window
  const [pickedDay, setPickedDay] = useState(businessToday)

  const todayKey = businessToday()
  // A fresh load or Back can land on a month whose grid doesn't hold the picked day. The agenda then lists the
  // month's anchor day instead of calling a day it never read empty.
  const shownDay = pickedDay >= businessDayKey(new Date(range.from)) && pickedDay <= businessDayKey(new Date(range.to))
    ? pickedDay
    : anchor
  const isViewingToday = shownDay === todayKey && anchor.slice(0, 7) === todayKey.slice(0, 7)

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
              setPickedDay(todayKey)
              setAnchor(undefined)
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
        rows={query.rows}
        isPending={isPending}
        isError={query.isError}
        onRetry={() => void query.refresh()}
        month={anchor}
        onMonthChange={setAnchor}
        selectedDay={shownDay}
        onSelectDay={setPickedDay}
      />
    </DashboardModule>
  )
}
