import type { DataTableFilterConfig } from '@/shared/components/data-table/types'

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
    id: 'status',
    label: 'Status',
    type: 'select',
    columnId: 'status',
    placeholder: 'All statuses',
    options: proposalStatuses.map(s => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: s })),
  },
]
