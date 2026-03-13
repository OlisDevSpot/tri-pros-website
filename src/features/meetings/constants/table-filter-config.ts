import type { DataTableFilterConfig } from '@/shared/components/data-table/types'

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
