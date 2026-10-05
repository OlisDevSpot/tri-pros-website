import type { DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'

/**
 * Shared by `customers-table.tsx` (client) and `dashboard/customers/page.tsx` (server prefetch):
 * one object, one query key. Do not inline these values at either call site.
 */
export const CUSTOMERS_TABLE_QUERY_CONFIG = {
  fields: CUSTOMER_FIELDS,
  paramPrefix: 'pc',
  toolbar: ['pipeline', 'createdAt'],
  defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
  window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
} as const satisfies DataViewQueryConfig<typeof CUSTOMER_FIELDS>

/** Columns shown by default on the customers records table. */
export const CUSTOMERS_TABLE_SHOW_COLUMNS = ['name', 'leadSourceName', 'pipeline', 'createdAt'] as const
