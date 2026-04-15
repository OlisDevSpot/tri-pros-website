import type { EntityActionOption } from '@/shared/components/entity-actions/types'

import { selectableMeetingOutcomes } from '@/shared/constants/enums'
import { MEETING_OUTCOME_DOT_COLORS, MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'

export const MEETING_OUTCOME_OPTIONS: EntityActionOption[] = selectableMeetingOutcomes.map(value => ({
  label: MEETING_OUTCOME_LABELS[value] ?? value.replace(/_/g, ' '),
  value,
  color: MEETING_OUTCOME_DOT_COLORS[value],
}))
