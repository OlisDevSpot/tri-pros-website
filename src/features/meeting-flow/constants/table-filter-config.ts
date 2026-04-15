import type { DataTableFilterConfig } from '@/shared/components/data-table/types'

import { DEFAULT_TIME_PRESETS } from '@/shared/components/data-table/constants/time-filter-presets'
import { meetingOutcomes } from '@/shared/constants/enums'

export const meetingTableFilters: DataTableFilterConfig[] = [
  {
    id: 'search',
    label: 'Search',
    type: 'search',
    columnId: 'customerName',
    placeholder: 'Filter meetings...',
  },
  {
    id: 'scheduled',
    label: 'Scheduled for',
    type: 'time-preset',
    columnId: 'scheduledFor',
    presets: DEFAULT_TIME_PRESETS,
  },
  {
    id: 'outcome',
    label: 'Outcome',
    type: 'select',
    columnId: 'meetingOutcome',
    placeholder: 'All outcomes',
    options: meetingOutcomes.map(o => ({
      label: o.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: o,
    })),
  },
]
