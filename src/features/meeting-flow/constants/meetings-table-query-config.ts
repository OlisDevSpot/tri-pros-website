import type { PaginatedQueryConfig } from '@/shared/dal/lib/query/derive-paginated-query-state'

import { MEETING_FILTER_CONFIG } from '@/features/meeting-flow/constants/meeting-table-filter-config'
import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'

/**
 * Shared paginated-query config for the meetings records table. Imported by
 * BOTH `table/index.tsx` (client: `usePaginatedQuery`) and
 * `dashboard/meetings/page.tsx` (server: `loadPaginatedQueryInput`) — one
 * object, one query key. Do not inline these values at either call site.
 */
export const MEETINGS_TABLE_QUERY_CONFIG = {
  paramPrefix: 'pm',
  pageSize: 20,
  pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
  filters: MEETING_FILTER_CONFIG,
} as const satisfies PaginatedQueryConfig
