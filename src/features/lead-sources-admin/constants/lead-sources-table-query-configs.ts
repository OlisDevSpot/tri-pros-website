import type { PaginatedQueryConfig } from '@/shared/dal/lib/query/derive-paginated-query-state'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { CUSTOMER_FILTER_CONFIG } from '@/shared/entities/customers/constants/customer-filter-config'

/**
 * Shared paginated-query config for lead-source customers table.
 * Used by `lead-source-customers-section.tsx`.
 */
export const LEAD_SOURCE_CUSTOMERS_TABLE_QUERY_CONFIG = {
  paramPrefix: 'src',
  pageSize: 20,
  pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
  filters: CUSTOMER_FILTER_CONFIG,
} as const satisfies PaginatedQueryConfig

/**
 * Shared paginated-query config for all-customers table.
 * Used by `all-customers-section.tsx`.
 */
export const ALL_CUSTOMERS_TABLE_QUERY_CONFIG = {
  paramPrefix: 'all',
  pageSize: 20,
  pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
  filters: CUSTOMER_FILTER_CONFIG,
} as const satisfies PaginatedQueryConfig
