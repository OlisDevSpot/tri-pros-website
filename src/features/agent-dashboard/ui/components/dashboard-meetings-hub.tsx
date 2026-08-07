'use client'

import Link from 'next/link'

import { ROOTS } from '@/shared/config/roots'

import { DashboardMeetingsCalendar } from './dashboard-meetings-calendar'
import { DashboardModule } from './dashboard-module'

/**
 * Meetings module — the dashboard's focal moment. Renders the month
 * calendar + day-agenda composition (see ./dashboard-meetings-calendar.tsx),
 * which replaced the earlier Today/Upcoming/Past tabs.
 */
export function DashboardMeetingsHub() {
  return (
    <DashboardModule
      title="Meetings"
      action={(
        <Link
          href={ROOTS.dashboard.meetings.root()}
          className="-mr-2 -my-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent/50 hover:text-primary"
        >
          See all →
        </Link>
      )}
    >
      <DashboardMeetingsCalendar />
    </DashboardModule>
  )
}
