'use client'

import type { OmniMeeting, OmniRecordLayout, RecentOmniItem } from '@/features/omni-search/types'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OMNI_ICON_TILE_CLASS, OMNI_KIND_LABEL_CLASS, OMNI_RECORD_ICONS, OMNI_ROW_CLASSES } from '@/features/omni-search/constants/omni-search'
import { omniRowLabel } from '@/features/omni-search/lib/omni-row-label'
import { CommandItem } from '@/shared/components/ui/command'
import { MeetingOutcomeBadge } from '@/shared/entities/meetings/components/meeting-outcome-badge'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { formatMeetingShortStamp } from '@/shared/lib/formatters'

interface Props {
  meeting: OmniMeeting
  layout: OmniRecordLayout
  onSelect: (item: RecentOmniItem) => void
  disabled?: boolean
}

export function OmniMeetingItem({ meeting, layout, onSelect, disabled }: Props) {
  const Icon = OMNI_RECORD_ICONS.meeting
  const when = formatMeetingShortStamp(meeting.scheduledFor)
  const value = `meeting:${meeting.id}`
  const select = () => onSelect({ key: value, kind: 'meeting', label: meeting.customerName, sublabel: when, target: meeting.target })
  const detail = `${when} · ${meeting.meetingType}`
  const label = omniRowLabel(OMNI_COPY.kinds.meeting, meeting.customerName, detail, MEETING_OUTCOME_LABELS[meeting.meetingOutcome])
  const badge = <MeetingOutcomeBadge outcome={meeting.meetingOutcome} />

  if (layout === 'nested') {
    return (
      <CommandItem aria-label={label} disabled={disabled} value={value} onSelect={select} className={OMNI_ROW_CLASSES.nested}>
        <span className={OMNI_KIND_LABEL_CLASS}>{OMNI_COPY.kinds.meeting}</span>
        <span className="min-w-0 flex-1 truncate text-foreground">{detail}</span>
        {badge}
      </CommandItem>
    )
  }

  return (
    <CommandItem aria-label={label} disabled={disabled} value={value} onSelect={select} className={OMNI_ROW_CLASSES.line}>
      <span aria-hidden className={OMNI_ICON_TILE_CLASS}><Icon /></span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-foreground">{meeting.customerName}</span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      {badge}
    </CommandItem>
  )
}
