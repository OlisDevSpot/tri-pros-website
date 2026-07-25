import type { PaginatedQueryConfig } from '@/shared/dal/lib/query/derive-paginated-query-state'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { CUSTOMER_FILTER_CONFIG } from '@/shared/entities/customers/constants/customer-filter-config'

/**
 * Shared paginated-query config for the customers records table. Imported by
 * BOTH `customers-table.tsx` (client: `usePaginatedQuery`) and
 * `dashboard/customers/page.tsx` (server: `loadPaginatedQueryInput`) — one
 * object, one query key. Do not inline these values at either call site.
 */
export const CUSTOMERS_TABLE_QUERY_CONFIG = {
  paramPrefix: 'pc',
  pageSize: 20,
  pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
  filters: CUSTOMER_FILTER_CONFIG,
} as const satisfies PaginatedQueryConfig

/** Columns shown by default on the customers records table. */
export const CUSTOMERS_TABLE_SHOW_COLUMNS = ['name', 'leadSourceName', 'pipeline', 'createdAt'] as const
