'use client'

import type { MeetingListRow } from '@/shared/entities/meetings/dal/server/queries'

import { FileTextIcon } from 'lucide-react'

import { MeetingOverviewCard } from '@/shared/entities/meetings/components/overview-card'
import { ParticipantsSlot } from '@/shared/entities/meetings/components/participants-slot'
import { cn } from '@/shared/lib/utils'

interface DashboardMeetingCardProps {
  row: MeetingListRow
  /**
   * Today's rail already shows the time on its own hairline label, so the
   * card omits `scheduledDate` there. Upcoming/Past have no rail, so they
   * need date+time inside the card — pass `true` for those.
   */
  showScheduledDate?: boolean
  className?: string
}

/**
 * Shared dense `MeetingOverviewCard` composition — customer name, outcome
 * dot, compact actions, type (+ optionally date), proposal-count badge, and
 * compact participants. Used by both `DashboardTodayTimeline` (wrapped in
 * the left time-rail) and `DashboardMeetingsList` (wrapped in `EntityList`)
 * so the two dashboard meeting surfaces can't drift apart.
 *
 * `proposalCount` renders as a standalone badge (matching
 * `MeetingOverviewCard`'s own `ProposalCountField` markup) rather than going
 * through `.Fields field: 'proposalCount'`, because that field reads
 * `meeting.proposals?.length` — full proposal objects the dashboard's list
 * query doesn't fetch. `MeetingListRow` only has the `proposalCount` number.
 */
export function DashboardMeetingCard({ row, showScheduledDate = false, className }: DashboardMeetingCardProps) {
  return (
    <MeetingOverviewCard
      meeting={row}
      customerId={row.customerId ?? ''}
      className={cn('rounded-lg border border-border bg-card p-2.5', className)}
    >
      <MeetingOverviewCard.Header className="min-w-0 gap-1.5">
        <MeetingOverviewCard.Fields fields={[{ field: 'outcome', variant: 'dot' }]} className="flex-none" />
        <MeetingOverviewCard.CustomerName className="min-w-0 flex-1 truncate font-medium" />
        <MeetingOverviewCard.Actions mode="compact" className="shrink-0" />
      </MeetingOverviewCard.Header>

      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <MeetingOverviewCard.Fields
          fields={showScheduledDate
            ? [{ field: 'scheduledDate', format: 'full' }, { field: 'type' }]
            : [{ field: 'type' }]}
          className="flex-none"
        />
        {row.proposalCount > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
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
