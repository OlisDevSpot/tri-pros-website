'use client'

import type { MeetingWindowKind } from '@/features/agent-dashboard/lib/meeting-windows'

import { useQuery } from '@tanstack/react-query'

import { meetingsWindowInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { EntityList } from '@/shared/components/entity-list/ui/entity-list'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

import { DashboardMeetingCard } from './dashboard-meeting-card'

interface DashboardMeetingsListProps {
  /** 'today' is handled by `DashboardTodayTimeline` — this component only covers the two plain-list windows. */
  kind: Exclude<MeetingWindowKind, 'today'>
}

/**
 * Dense, flat roster for the Upcoming/Past tabs — no time rail (that
 * treatment is Today-only). Each row shows date+time via `.Fields`
 * (`scheduledDate` format `full`) instead of the rail's standalone time
 * label. Same query/cap contract as the Today timeline
 * (`meetingsWindowInput`, capped server-side at `DASHBOARD_LIMITS.meetings`).
 */
export function DashboardMeetingsList({ kind }: DashboardMeetingsListProps) {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.meetingsRouter.reads.list.queryOptions(meetingsWindowInput(kind)))

  if (isLoading) {
    return <MeetingsListSkeleton />
  }

  return (
    <EntityList
      title={kind === 'upcoming' ? 'Upcoming' : 'Past'}
      items={data?.rows ?? []}
      getItemKey={row => row.id}
      renderItem={row => <DashboardMeetingCard row={row} showScheduledDate />}
      emptyState={{ message: kind === 'upcoming' ? 'No upcoming meetings' : 'No past meetings' }}
      variant="flush"
    />
  )
}

/** 3 dense card-shaped rows, matching `DashboardMeetingCard`'s resting height. */
function MeetingsListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map(i => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}
