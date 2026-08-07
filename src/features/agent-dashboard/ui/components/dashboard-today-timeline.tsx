'use client'

import type { MeetingListRow } from '@/shared/entities/meetings/dal/server/queries'

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import Link from 'next/link'

import { meetingsWindowInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { ROOTS } from '@/shared/config/roots'
import { useTRPC } from '@/trpc/helpers'

import { DashboardMeetingCard } from './dashboard-meeting-card'

/**
 * Today's meetings as a compact left time rail — the dashboard's focal
 * moment ("the shape of my day"). One row per meeting: a `h:mm a` time label
 * on a hairline rail with a dot marker, and a densely-composed
 * `MeetingOverviewCard` attached to the right. Rows are already
 * chronological (query sorts `scheduledFor` ascending) and already capped at
 * `DASHBOARD_LIMITS.meetings` server-side via `meetingsWindowInput`.
 */
export function DashboardTodayTimeline() {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.meetingsRouter.reads.list.queryOptions(meetingsWindowInput('today')))

  if (isLoading) {
    return <TodayTimelineSkeleton />
  }

  const rows = data?.rows ?? []

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-start gap-0.5 py-2">
        <p className="text-sm text-muted-foreground">No meetings today</p>
        <Link
          href={ROOTS.dashboard.schedule()}
          className="-mx-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-primary transition-colors duration-200 hover:bg-accent/50"
        >
          Book one →
        </Link>
      </div>
    )
  }

  return (
    <ol className="flex flex-col">
      {rows.map(row => (
        <TodayTimelineRow key={row.id} row={row} />
      ))}
    </ol>
  )
}

/** One rail row: time label + hairline/dot + the meeting card. */
function TodayTimelineRow({ row }: { row: MeetingListRow }) {
  return (
    <li className="flex gap-3">
      <div className="flex w-12 shrink-0 justify-end pt-2">
        <span className="font-mono text-[0.72rem] tabular-nums text-muted-foreground">
          {format(new Date(row.scheduledFor), 'h:mm a')}
        </span>
      </div>

      <div className="relative shrink-0">
        <div className="h-full w-px bg-border" />
        <span className="absolute left-1/2 top-2.5 size-1.5 -translate-x-1/2 rounded-full bg-primary" />
      </div>

      <div className="flex-1 pb-3 pt-1">
        <DashboardMeetingCard row={row} />
      </div>
    </li>
  )
}

/** 3 rail-shaped rows — matches the real row's [time][rail][card] geometry. */
function TodayTimelineSkeleton() {
  return (
    <ol className="flex flex-col">
      {[0, 1, 2].map(i => (
        <li key={i} className="flex gap-3">
          <div className="flex w-12 shrink-0 justify-end pt-2">
            <Skeleton className="h-3 w-8" />
          </div>
          <div className="relative shrink-0">
            <div className="h-full w-px bg-border" />
          </div>
          <div className="flex-1 pb-3 pt-1">
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        </li>
      ))}
    </ol>
  )
}
