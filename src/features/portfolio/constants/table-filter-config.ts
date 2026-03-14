import type { DataTableFilterConfig } from '@/shared/components/data-table/types'

import { DEFAULT_TIME_PRESETS } from '@/shared/components/data-table/constants/time-filter-presets'

export const portfolioTableFilters: DataTableFilterConfig[] = [
  {
    id: 'search',
    label: 'Search',
    type: 'search',
    columnId: 'title',
    placeholder: 'Filter projects...',
  },
  {
    id: 'time',
    label: 'Time',
    type: 'time-preset',
    columnId: 'createdAt',
    presets: DEFAULT_TIME_PRESETS,
  },
  {
    id: 'visibility',
    label: 'Status',
    type: 'select',
    columnId: 'isPublic',
    placeholder: 'All',
    options: [
      { label: 'Public', value: 'true' },
      { label: 'Draft', value: 'false' },
    ],
  },
]
