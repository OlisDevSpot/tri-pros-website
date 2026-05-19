import type { FilterDefinition } from '@/shared/dal/client/lib/types'

import { DEFAULT_TIME_PRESETS } from '@/shared/components/data-table/constants/time-filter-presets'

/**
 * Filter config for customer tables. Ids match the `filters` shape on the
 * server (`customersRouter.list`, `leadSourcesRouter.getCustomers`).
 *
 * Pipeline values are the canonical 5-bucket `pipelines` enum — both
 * server queries translate the selection through `derivedPipelineWhere`
 * so the underlying 3-bucket DB column stays an implementation detail.
 */
export const CUSTOMER_FILTER_CONFIG = [
  {
    id: 'pipeline',
    type: 'multi-select',
    label: 'Pipeline',
    options: [
      { label: 'Projects', value: 'projects' },
      { label: 'Fresh', value: 'fresh' },
      { label: 'Leads', value: 'leads' },
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
