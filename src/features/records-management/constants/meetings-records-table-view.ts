import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { MeetingColumnKey } from '@/shared/entities/meetings/lib/columns-registry'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'

export const MEETINGS_RECORDS_TABLE_VIEW = {
  tableId: 'meetings',
  query: {
    fields: MEETING_FIELDS,
    paramPrefix: 'pm',
    toolbar: ['meetingType', 'proposalStatus', 'trade', 'rep', 'setter', 'leadSource', 'outcome', 'scheduledFor', 'createdAt', 'pipeline'],
    // A meeting's scheduled slot is its natural axis, so this table sorts by it rather than by booking date.
    defaultSort: { sortBy: 'scheduledFor', sortDir: 'desc' },
    window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
  },
  columns: ['customerName', 'meetingType', 'meetingOutcome', 'ownerName', 'setter', 'scheduledFor', 'createdAt', 'tradeSelections', 'leadSource', 'proposalStatuses'],
} as const satisfies EntityTableView<MeetingColumnKey, typeof MEETING_FIELDS>
