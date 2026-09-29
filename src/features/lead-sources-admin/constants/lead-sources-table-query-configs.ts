import type { DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'

/** "Customers from this source" pane; `leadSourcesRouter.getCustomers` pins the source itself. */
export const LEAD_SOURCE_CUSTOMERS_TABLE_QUERY_CONFIG = {
  fields: CUSTOMER_FIELDS,
  paramPrefix: 'src',
  toolbar: ['pipeline', 'createdAt'],
  defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
  window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
} as const satisfies DataViewQueryConfig<typeof CUSTOMER_FIELDS>

/** "All customers" pane. */
export const ALL_CUSTOMERS_TABLE_QUERY_CONFIG = {
  fields: CUSTOMER_FIELDS,
  paramPrefix: 'all',
  toolbar: ['pipeline', 'createdAt'],
  defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
  window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
} as const satisfies DataViewQueryConfig<typeof CUSTOMER_FIELDS>
