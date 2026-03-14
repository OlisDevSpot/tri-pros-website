import type { DataTableFilterConfig } from '@/shared/components/data-table/types'

import { DEFAULT_TIME_PRESETS } from '@/shared/components/data-table/constants/time-filter-presets'
import { proposalStatuses } from '@/shared/constants/enums'

export const proposalTableFilters: DataTableFilterConfig[] = [
  {
    id: 'search',
    label: 'Search',
    type: 'search',
    columnId: 'label',
    placeholder: 'Filter proposals...',
  },
  {
    id: 'time',
    label: 'Time',
    type: 'time-preset',
    columnId: 'createdAt',
    presets: DEFAULT_TIME_PRESETS,
  },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    columnId: 'status',
    placeholder: 'All statuses',
    options: proposalStatuses.map(s => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s })),
  },
]
