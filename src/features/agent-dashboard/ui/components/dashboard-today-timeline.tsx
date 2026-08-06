'use client'

import type { MeetingListRow } from '@/shared/entities/meetings/dal/server/queries'

import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { FileTextIcon } from 'lucide-react'
import Link from 'next/link'

import { meetingsWindowInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { ROOTS } from '@/shared/config/roots'
import { MeetingOverviewCard } from '@/shared/entities/meetings/components/overview-card'
import { ParticipantsSlot } from '@/shared/entities/meetings/components/participants-slot'
import { useTRPC } from '@/trpc/helpers'

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
      <p className="py-6 text-sm text-muted-foreground">
        {'No meetings today — '}
        <Link href={ROOTS.dashboard.schedule()} className="font-medium text-primary hover:underline">
          book one
        </Link>
      </p>
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
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {format(new Date(row.scheduledFor), 'h:mm a')}
        </span>
      </div>

      <div className="relative shrink-0">
        <div className="h-full w-px bg-border" />
        <span className="absolute left-1/2 top-2.5 size-1.5 -translate-x-1/2 rounded-full bg-primary" />
      </div>

      <div className="flex-1 pb-3 pt-1">
        <MeetingOverviewCard
          meeting={row}
          customerId={row.customerId ?? ''}
          className="rounded-lg border border-border bg-card p-2.5"
        >
          <MeetingOverviewCard.Header className="min-w-0 gap-1.5">
            <MeetingOverviewCard.Fields fields={[{ field: 'outcome', variant: 'dot' }]} className="flex-none" />
            <MeetingOverviewCard.CustomerName className="min-w-0 flex-1 truncate font-medium" />
            <MeetingOverviewCard.Actions mode="compact" className="shrink-0" />
          </MeetingOverviewCard.Header>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <MeetingOverviewCard.Fields fields={[{ field: 'type' }]} className="flex-none" />
            {row.proposalCount > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <FileTextIcon className="size-3" />
                {row.proposalCount}
              </span>
            )}
            <ParticipantsSlot
              meetingId={row.id}
              variant="compact"
              initialParticipants={row.participants}
              className="ml-auto"
            />
          </div>
        </MeetingOverviewCard>
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
