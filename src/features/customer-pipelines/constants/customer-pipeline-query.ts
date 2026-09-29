import type { DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'

import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'

/** No default sort: without `cp_sort` each pipeline keeps its own natural order. `pipeline` itself comes from the route. */
export const CUSTOMER_PIPELINE_QUERY = {
  fields: CUSTOMER_FIELDS,
  paramPrefix: 'cp',
  toolbar: ['rep', 'leadSource', 'createdAt'],
  window: { kind: 'whole-list' },
} as const satisfies DataViewQueryConfig<typeof CUSTOMER_FIELDS>
