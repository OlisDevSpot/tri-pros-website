'use client'

import Link from 'next/link'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { ROOTS } from '@/shared/config/roots'

import { DashboardMeetingsList } from './dashboard-meetings-list'
import { DashboardModule } from './dashboard-module'
import { DashboardTodayTimeline } from './dashboard-today-timeline'

/**
 * Meetings module — the dashboard's focal moment. Today / Upcoming / Past
 * tabs (default Today); Today renders the compact day-timeline, Upcoming/Past
 * render plain dense lists (see ./dashboard-today-timeline.tsx and
 * ./dashboard-meetings-list.tsx).
 *
 * Tabs lazy-mount for free: Radix's `TabsContent` only renders a tab's
 * children once it becomes selected (no `forceMount` here), so Upcoming/Past
 * never fire their `meetingsRouter.reads.list` query until the rep opens that
 * tab. Only Today is prefetched server-side (see `dashboard/page.tsx`).
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
      <Tabs defaultValue="today">
        <TabsList className="h-auto">
          <TabsTrigger value="today" className="min-h-11 data-[state=active]:text-primary">Today</TabsTrigger>
          <TabsTrigger value="upcoming" className="min-h-11 data-[state=active]:text-primary">Upcoming</TabsTrigger>
          <TabsTrigger value="past" className="min-h-11 data-[state=active]:text-primary">Past</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-3">
          <DashboardTodayTimeline />
        </TabsContent>
        <TabsContent value="upcoming" className="mt-3">
          <DashboardMeetingsList kind="upcoming" />
        </TabsContent>
        <TabsContent value="past" className="mt-3">
          <DashboardMeetingsList kind="past" />
        </TabsContent>
      </Tabs>
    </DashboardModule>
  )
}
