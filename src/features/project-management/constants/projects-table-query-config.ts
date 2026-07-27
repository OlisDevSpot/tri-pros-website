import type { PaginatedQueryConfig } from '@/shared/dal/lib/query/derive-paginated-query-state'

import { PROJECT_FILTER_CONFIG } from '@/features/project-management/constants/project-table-filter-config'
import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'

/**
 * Shared paginated-query config for the projects records table. Imported by
 * BOTH `table/index.tsx` (client: `usePaginatedQuery`) and
 * `dashboard/projects/page.tsx` (server: `loadPaginatedQueryInput`) — one
 * object, one query key. Do not inline these values at either call site.
 */
export const PROJECTS_TABLE_QUERY_CONFIG = {
  paramPrefix: 'pj',
  pageSize: 20,
  pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
  filters: PROJECT_FILTER_CONFIG,
} as const satisfies PaginatedQueryConfig
