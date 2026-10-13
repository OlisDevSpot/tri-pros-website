'use client'

import type { RecentOmniItem } from '@/features/omni-search/types'
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { OMNI_RECORD_ICONS } from '@/features/omni-search/constants/omni-search'
import { CommandItem } from '@/shared/components/ui/command'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { formatMeetingShortStamp } from '@/shared/lib/formatters'

type OmniMeeting = AppRouterOutputs['searchRouter']['omni']['meetings'][number]

interface Props {
  meeting: OmniMeeting
  onSelect: (item: RecentOmniItem) => void
}

export function OmniMeetingItem({ meeting, onSelect }: Props) {
  const Icon = OMNI_RECORD_ICONS.meeting
  const when = formatMeetingShortStamp(meeting.scheduledFor)
  return (
    <CommandItem
      value={`meeting:${meeting.id}`}
      onSelect={() => onSelect({ key: `meeting:${meeting.id}`, kind: 'meeting', label: meeting.customerName, sublabel: when, target: meeting.target })}
    >
      <Icon aria-hidden className="text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        <span className="text-foreground">{meeting.customerName}</span>
        <span className="text-muted-foreground">{` · ${when}`}</span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">{MEETING_OUTCOME_LABELS[meeting.meetingOutcome]}</span>
    </CommandItem>
  )
}
