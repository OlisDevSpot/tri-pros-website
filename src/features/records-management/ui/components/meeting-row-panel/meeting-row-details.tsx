'use client'

import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { MeetingOutcomeBadge } from '@/shared/entities/meetings/components/meeting-outcome-badge'
import { UserOverviewCard } from '@/shared/entities/users/components/overview-card'
import { formatDateCell } from '@/shared/lib/formatters'

export function MeetingRowDetails({ meeting }: { meeting: MeetingRow }) {
  const scheduled = meeting.scheduledFor ? formatDateCell(meeting.scheduledFor) : null
  return (
    <>
      {scheduled && (
        <span className="basis-full font-medium text-foreground">
          {scheduled.relative}
          {' · '}
          {scheduled.dayAtTime}
        </span>
      )}
      <MeetingOutcomeBadge outcome={meeting.meetingOutcome} />
      <UserOverviewCard.InlineList users={meeting.participants} mode="full" />
    </>
  )
}
