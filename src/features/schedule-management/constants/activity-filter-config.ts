import type { DataTableFilterConfig } from '@/shared/components/data-table/types'

import { DEFAULT_TIME_PRESETS } from '@/shared/components/data-table/constants/time-filter-presets'
import { activityEntityTypes, activityTypes } from '@/shared/constants/enums'
import { capitalize } from '@/shared/lib/formatters'

export const activityTableFilters: DataTableFilterConfig[] = [
  {
    id: 'search',
    label: 'Search',
    type: 'search',
    columnId: 'title',
    placeholder: 'Filter activities...',
  },
  {
    id: 'type',
    label: 'Type',
    type: 'select',
    columnId: 'type',
    placeholder: 'All types',
    options: activityTypes.map(t => ({
      label: capitalize(t),
      value: t,
    })),
  },
  {
    id: 'entityType',
    label: 'Entity Type',
    type: 'select',
    columnId: 'entityType',
    placeholder: 'All entities',
    options: activityEntityTypes.map(e => ({
      label: capitalize(e),
      value: e,
    })),
  },
  {
    id: 'scheduledFor',
    label: 'Scheduled for',
    type: 'time-preset',
    columnId: 'scheduledFor',
    presets: DEFAULT_TIME_PRESETS,
  },
]
