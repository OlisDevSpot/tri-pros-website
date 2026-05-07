import type { FilterDefinition } from '@/shared/dal/client/query/types'

import {
  TIME_PRESET_LAST_WEEK,
  TIME_PRESET_THIS_MONTH,
  TIME_PRESET_THIS_WEEK,
  TIME_PRESET_THIS_YEAR,
  TIME_PRESET_TODAY,
  TIME_PRESET_YEAR_TO_DATE,
} from '@/shared/components/data-table/constants/time-filter-presets'
import { projectStatuses } from '@/shared/constants/enums'

const DEFAULT_PRESETS = [
  TIME_PRESET_TODAY,
  TIME_PRESET_THIS_WEEK,
  TIME_PRESET_LAST_WEEK,
  TIME_PRESET_THIS_MONTH,
  TIME_PRESET_YEAR_TO_DATE,
  TIME_PRESET_THIS_YEAR,
]

const STATUS_LABELS: Record<(typeof projectStatuses)[number], string> = {
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On Hold',
}

/**
 * Filter config for the projects table. Ids match `projectsRouter.crud.list`'s
 * `filters` shape on the server.
 */
export const PROJECT_FILTER_CONFIG = [
  {
    id: 'status',
    type: 'multi-select',
    label: 'Status',
    options: projectStatuses.map(s => ({ label: STATUS_LABELS[s], value: s })),
  },
  {
    id: 'visibility',
    type: 'select',
    label: 'Visibility',
    options: [
      { label: 'Public', value: 'public' },
      { label: 'Draft', value: 'draft' },
    ],
  },
  {
    id: 'completedAt',
    type: 'date-range',
    label: 'Completed',
    presets: DEFAULT_PRESETS,
  },
  {
    id: 'createdAt',
    type: 'date-range',
    label: 'Created',
    presets: DEFAULT_PRESETS,
  },
] as const satisfies readonly FilterDefinition[]

export const PROJECT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
