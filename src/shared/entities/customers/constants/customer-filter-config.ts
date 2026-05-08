import type { FilterDefinition } from '@/shared/dal/client/query/types'

import { DEFAULT_TIME_PRESETS } from '@/shared/components/data-table/constants/time-filter-presets'

/**
 * Filter config for customer tables. Ids match `customersRouter.list`'s
 * `filters` shape on the server.
 */
export const CUSTOMER_FILTER_CONFIG = [
  {
    id: 'pipeline',
    type: 'multi-select',
    label: 'Pipeline',
    options: [
      { label: 'Active', value: 'active' },
      { label: 'Rehash', value: 'rehash' },
      { label: 'Dead', value: 'dead' },
    ],
  },
  {
    id: 'createdAt',
    type: 'date-range',
    label: 'Created',
    presets: DEFAULT_TIME_PRESETS,
  },
] as const satisfies readonly FilterDefinition[]
