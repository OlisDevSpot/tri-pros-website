import type { PaginatedQueryConfig } from '@/shared/dal/lib/query/derive-paginated-query-state'

import { ACTIVITY_FILTER_CONFIG, ACTIVITY_PAGE_SIZE_OPTIONS } from '@/features/schedule-management/constants/activity-filter-config'

/**
 * Shared paginated-query config for the activities records table. Imported
 * by `activities-table.tsx` (client: `usePaginatedQuery`) — one object, one
 * query key. Do not inline these values at the call site.
 *
 * Note: this table's mount site is not on a converted (Tier-1 or paginated
 * prefetch) page, so there is no server-side `loadPaginatedQueryInput`
 * consumer yet — extraction only, for the `no-inline-table-config` flip.
 */
export const ACTIVITIES_TABLE_QUERY_CONFIG = {
  paramPrefix: 'act',
  pageSize: 20,
  pageSizeOptions: ACTIVITY_PAGE_SIZE_OPTIONS,
  filters: ACTIVITY_FILTER_CONFIG,
} as const satisfies PaginatedQueryConfig
