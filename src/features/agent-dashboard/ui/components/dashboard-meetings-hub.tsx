'use client'

import { CalendarCheckIcon } from 'lucide-react'
import { useState } from 'react'

import { DASHBOARD_MEETINGS_EXTRA, DASHBOARD_MEETINGS_QUERY } from '@/features/agent-dashboard/constants/dashboard-queries'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { businessDayKey, businessToday } from '@/shared/lib/business-time'
import { useTRPC } from '@/trpc/helpers'

import { DashboardMeetingsCalendar } from './dashboard-meetings-calendar'
import { DashboardModule } from './dashboard-module'
import { DashboardSeeAllLink } from './dashboard-see-all-link'

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
              if (anchor !== todayKey) {
                setAnchor(undefined)
              }
            }}
            className="-my-1 size-8 text-muted-foreground hover:text-foreground"
          >
            <CalendarCheckIcon className="size-4" />
          </Button>
          <DashboardSeeAllLink href={ROOTS.dashboard.meetings.root()} />
        </div>
      )}
    >
      <DashboardMeetingsCalendar
        rows={query.rows}
        isPending={isPending}
        month={anchor}
        onMonthChange={setAnchor}
        selectedDay={shownDay}
        onSelectDay={setPickedDay}
      />
    </DashboardModule>
  )
}
