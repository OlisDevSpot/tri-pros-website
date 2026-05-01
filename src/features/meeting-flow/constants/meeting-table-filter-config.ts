import type { FilterDefinition } from '@/shared/dal/client/query/types'

import {
  TIME_PRESET_LAST_WEEK,
  TIME_PRESET_THIS_MONTH,
  TIME_PRESET_THIS_WEEK,
  TIME_PRESET_THIS_YEAR,
  TIME_PRESET_TODAY,
  TIME_PRESET_YEAR_TO_DATE,
} from '@/shared/components/data-table/constants/time-filter-presets'
import { meetingOutcomes } from '@/shared/constants/enums'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'

/**
 * Filter config for the meetings tables (past-meetings + meetings-view table
 * mode). Ids match `meetingsRouter.list`'s `filters` shape on the server.
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
    presets: [
      TIME_PRESET_TODAY,
      TIME_PRESET_THIS_WEEK,
      TIME_PRESET_LAST_WEEK,
      TIME_PRESET_THIS_MONTH,
      TIME_PRESET_YEAR_TO_DATE,
      TIME_PRESET_THIS_YEAR,
    ],
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

export const MEETING_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
