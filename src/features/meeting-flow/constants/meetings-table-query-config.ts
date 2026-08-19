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
  // Meetings default to scheduled-time order (newest first), not the
  // createdAt-desc convention every other record table inherits — a meeting's
  // scheduled slot is its natural axis. Sent as an explicit sort, so only this
  // table is affected; the shared DAL default (createdAt DESC) and the
  // schedule/calendar consumers are untouched.
  defaultSort: { sortBy: 'scheduledFor', sortDir: 'desc' },
  filters: MEETING_FILTER_CONFIG,
} as const satisfies PaginatedQueryConfig
