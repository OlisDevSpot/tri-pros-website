import type { FilterDefinition } from '@/shared/dal/client/query/types'

import {
  TIME_PRESET_LAST_WEEK,
  TIME_PRESET_THIS_MONTH,
  TIME_PRESET_THIS_WEEK,
  TIME_PRESET_THIS_YEAR,
  TIME_PRESET_TODAY,
  TIME_PRESET_YEAR_TO_DATE,
} from '@/shared/components/data-table/constants/time-filter-presets'
import { proposalStatuses } from '@/shared/constants/enums'

const DEFAULT_PRESETS = [
  TIME_PRESET_TODAY,
  TIME_PRESET_THIS_WEEK,
  TIME_PRESET_LAST_WEEK,
  TIME_PRESET_THIS_MONTH,
  TIME_PRESET_YEAR_TO_DATE,
  TIME_PRESET_THIS_YEAR,
]

/**
 * Filter config for the proposals table. Ids match `proposalsRouter.crud.list`'s
 * `filters` shape on the server.
 */
export const PROPOSAL_FILTER_CONFIG = [
  {
    id: 'status',
    type: 'multi-select',
    label: 'Status',
    options: proposalStatuses.map(s => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      value: s,
    })),
  },
  {
    id: 'createdAt',
    type: 'date-range',
    label: 'Created',
    presets: DEFAULT_PRESETS,
  },
  {
    id: 'sentAt',
    type: 'date-range',
    label: 'Sent',
    presets: DEFAULT_PRESETS,
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

export const PROPOSAL_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
