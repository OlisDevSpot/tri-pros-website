import type { MeetingOutcome } from '@/shared/constants/enums'

import { Badge } from '@/shared/components/ui/badge'
import { MEETING_LIST_STATUS_COLORS, MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { cn } from '@/shared/lib/utils'

interface Props {
  outcome: MeetingOutcome
  className?: string
}

export function MeetingOutcomeBadge({ outcome, className }: Props) {
  // The fallbacks keep an outcome the maps don't know yet (a newer enum value) readable instead of blank.
  return (
    <Badge variant="outline" className={cn('text-xs', MEETING_LIST_STATUS_COLORS[outcome] ?? '', className)}>
      {MEETING_OUTCOME_LABELS[outcome] ?? outcome.replace(/_/g, ' ')}
    </Badge>
  )
}
