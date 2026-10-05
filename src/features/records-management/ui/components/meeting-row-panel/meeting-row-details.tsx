'use client'

import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { Badge } from '@/shared/components/ui/badge'
import { MEETING_LIST_STATUS_COLORS, MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { UserOverviewCard } from '@/shared/entities/users/components/overview-card'
import { formatDateCell } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

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
      <Badge variant="outline" className={cn('text-xs', MEETING_LIST_STATUS_COLORS[meeting.meetingOutcome])}>
        {MEETING_OUTCOME_LABELS[meeting.meetingOutcome] ?? meeting.meetingOutcome.replace(/_/g, ' ')}
      </Badge>
      <UserOverviewCard.InlineList users={meeting.participants} mode="full" />
    </>
  )
}
