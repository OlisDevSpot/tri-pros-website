'use client'

import type { MeetingWindowKind } from '@/features/agent-dashboard/lib/meeting-windows'
import type { MeetingListRow } from '@/shared/entities/meetings/dal/server/queries'

import { useQuery } from '@tanstack/react-query'
import { FileTextIcon } from 'lucide-react'

import { meetingsWindowInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { EntityList } from '@/shared/components/entity-list/ui/entity-list'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { MeetingOverviewCard } from '@/shared/entities/meetings/components/overview-card'
import { ParticipantsSlot } from '@/shared/entities/meetings/components/participants-slot'
import { useTRPC } from '@/trpc/helpers'

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
      renderItem={row => <MeetingListItem row={row} />}
      emptyState={{ message: kind === 'upcoming' ? 'No upcoming meetings' : 'No past meetings' }}
      variant="flush"
    />
  )
}

/** One dense roster row — same card internals as the Today rail row, minus the rail. */
function MeetingListItem({ row }: { row: MeetingListRow }) {
  return (
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
        <MeetingOverviewCard.Fields
          fields={[{ field: 'scheduledDate', format: 'full' }, { field: 'type' }]}
          className="flex-none"
        />
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
  )
}

/** 3 dense card-shaped rows, matching `MeetingListItem`'s resting height. */
function MeetingsListSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2].map(i => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}
