import type { EntityActionOption } from '@/shared/components/entity-actions/types'

import { MEETING_OUTCOME_DOT_COLORS, MEETING_OUTCOME_LABELS } from '@/features/meetings/constants/status-colors'
import { selectableMeetingOutcomes } from '@/shared/constants/enums'

/** Only manually selectable outcomes for entity action menus (excludes derived outcomes). */
export const MEETING_OUTCOME_OPTIONS: EntityActionOption[] = selectableMeetingOutcomes.map(value => ({
  label: MEETING_OUTCOME_LABELS[value] ?? value.replace(/_/g, ' '),
  value,
  color: MEETING_OUTCOME_DOT_COLORS[value],
}))
