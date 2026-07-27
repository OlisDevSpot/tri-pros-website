import type { PaginatedQueryConfig } from '@/shared/dal/lib/query/derive-paginated-query-state'

import { PROPOSAL_FILTER_CONFIG } from '@/features/proposal-flow/constants/proposal-table-filter-config'
import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'

/**
 * Shared paginated-query config for the proposals records table. Imported by
 * BOTH `table/index.tsx` (client: `usePaginatedQuery`) and
 * `dashboard/proposals/page.tsx` (server: `loadPaginatedQueryInput`) — one
 * object, one query key. Do not inline these values at either call site.
 */
export const PROPOSALS_TABLE_QUERY_CONFIG = {
  paramPrefix: 'pp',
  pageSize: 20,
  pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
  filters: PROPOSAL_FILTER_CONFIG,
} as const satisfies PaginatedQueryConfig
