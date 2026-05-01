import type { FilterDefinition } from '@/shared/dal/client/query/types'

import {
  TIME_PRESET_LAST_WEEK,
  TIME_PRESET_THIS_MONTH,
  TIME_PRESET_THIS_WEEK,
  TIME_PRESET_THIS_YEAR,
  TIME_PRESET_TODAY,
  TIME_PRESET_YEAR_TO_DATE,
} from '@/shared/components/data-table/constants/time-filter-presets'

/**
 * Filter config for the lead-source customer tables. Each entry's `id` is
 * BOTH the URL key suffix (e.g. `?src_pipeline=...`) AND the procedure input
 * field name (`filters.pipeline`). The server router declares matching Zod
 * shapes for `filters.pipeline` and `filters.createdAt`.
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
    presets: [
      TIME_PRESET_TODAY,
      TIME_PRESET_THIS_WEEK,
      TIME_PRESET_LAST_WEEK,
      TIME_PRESET_THIS_MONTH,
      TIME_PRESET_YEAR_TO_DATE,
      TIME_PRESET_THIS_YEAR,
    ],
  },
] as const satisfies readonly FilterDefinition[]

/**
 * Allowed page sizes for customer tables. Default is 20 (locked in the hook).
 */
export const CUSTOMER_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const
