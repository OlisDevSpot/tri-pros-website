import type { DataTableFilterConfig } from '@/shared/components/data-table/types'

import { DEFAULT_TIME_PRESETS } from '@/shared/components/data-table/constants/time-filter-presets'
import { meetingStatuses } from '@/shared/constants/enums'

export const meetingTableFilters: DataTableFilterConfig[] = [
  {
    id: 'search',
    label: 'Search',
    type: 'search',
    columnId: 'contactName',
    placeholder: 'Filter meetings...',
  },
  {
    id: 'created',
    label: 'Created at',
    type: 'time-preset',
    columnId: 'createdAt',
    presets: DEFAULT_TIME_PRESETS,
  },
  {
    id: 'scheduled',
    label: 'Scheduled for',
    type: 'time-preset',
    columnId: 'scheduledFor',
    presets: DEFAULT_TIME_PRESETS,
  },
  {
    id: 'status',
    label: 'Status',
    type: 'select',
    columnId: 'status',
    placeholder: 'All statuses',
    options: meetingStatuses.map(s => ({
      label: s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: s,
    })),
  },
]
