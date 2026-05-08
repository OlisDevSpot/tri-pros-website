import type { FilterDefinition } from '@/shared/dal/client/query/types'

import { DEFAULT_TIME_PRESETS } from '@/shared/components/data-table/constants/time-filter-presets'
import { meetingOutcomes } from '@/shared/constants/enums'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'

/**
 * Filter config for the meetings table. Ids match `meetingsRouter.list`'s
 * `filters` shape on the server.
 */
export const MEETING_FILTER_CONFIG = [
  {
    id: 'outcome',
    type: 'multi-select',
    label: 'Outcome',
    options: meetingOutcomes.map(o => ({
      label: MEETING_OUTCOME_LABELS[o] ?? o.replace(/_/g, ' '),
      value: o,
    })),
  },
  {
    id: 'scheduledFor',
    type: 'date-range',
    label: 'Scheduled',
    presets: DEFAULT_TIME_PRESETS,
  },
  {
    id: 'pipeline',
    type: 'select',
    label: 'Pipeline',
    options: [
      { label: 'Projects', value: 'projects' },
      { label: 'Fresh', value: 'fresh' },
      { label: 'Rehash', value: 'rehash' },
      { label: 'Dead', value: 'dead' },
    ],
  },
] as const satisfies readonly FilterDefinition[]
