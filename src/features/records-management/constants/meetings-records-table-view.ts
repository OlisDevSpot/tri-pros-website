import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { MeetingColumnKey } from '@/shared/entities/meetings/lib/columns-registry'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { MEETING_FILTER_CONFIG } from '@/shared/entities/meetings/constants/meeting-filter-config'

export const MEETINGS_RECORDS_TABLE_VIEW = {
  tableId: 'meetings',
  query: {
    paramPrefix: 'pm',
    pageSize: 20,
    pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS,
    // A meeting's scheduled slot is its natural axis, so this table sorts by it rather than the createdAt default.
    defaultSort: { sortBy: 'scheduledFor', sortDir: 'desc' },
    filters: MEETING_FILTER_CONFIG,
  },
  columns: ['customerName', 'meetingOutcome', 'ownerName', 'scheduledFor', 'tradeSelections'],
} as const satisfies EntityTableView<MeetingColumnKey>
