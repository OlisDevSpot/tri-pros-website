import type { FilterDefinition } from '@/shared/dal/client/query/types'

import {
  TIME_PRESET_LAST_WEEK,
  TIME_PRESET_THIS_MONTH,
  TIME_PRESET_THIS_WEEK,
  TIME_PRESET_THIS_YEAR,
  TIME_PRESET_TODAY,
  TIME_PRESET_YEAR_TO_DATE,
} from '@/shared/components/data-table/constants/time-filter-presets'
import { activityEntityTypes, activityTypes } from '@/shared/constants/enums'
import { capitalize } from '@/shared/lib/formatters'

const DEFAULT_PRESETS = [
  TIME_PRESET_TODAY,
  TIME_PRESET_THIS_WEEK,
  TIME_PRESET_LAST_WEEK,
  TIME_PRESET_THIS_MONTH,
  TIME_PRESET_YEAR_TO_DATE,
  TIME_PRESET_THIS_YEAR,
]

/**
 * Filter config for the activities table. Ids match
 * `scheduleRouter.activities.list`'s `filters` shape on the server.
 */
export const ACTIVITY_FILTER_CONFIG = [
  {
    id: 'type',
    type: 'multi-select',
    label: 'Type',
    options: activityTypes.map(t => ({ label: capitalize(t), value: t })),
  },
  {
    id: 'entityType',
    type: 'multi-select',
    label: 'Entity',
    options: activityEntityTypes.map(e => ({ label: capitalize(e), value: e })),
  },
  {
    id: 'scheduledFor',
    type: 'date-range',
    label: 'Scheduled',
    presets: DEFAULT_PRESETS,
  },
] as const satisfies readonly FilterDefinition[]

export const ACTIVITY_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
