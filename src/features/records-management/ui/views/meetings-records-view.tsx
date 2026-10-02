'use client'

import type { MeetingsExpandedRowContext } from '@/shared/entities/meetings/components/meetings-table/use-meetings-table'
import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { MEETINGS_RECORDS_TABLE_VIEW } from '@/features/records-management/constants/meetings-records-table-view'
import { MeetingRowPanel } from '@/features/records-management/ui/components/meeting-row-panel'
import { DataViewBoundary } from '@/shared/components/data-view-boundary'
import { RecordsPageFrame } from '@/shared/components/records-page-frame'
import { RecordsPageHeader } from '@/shared/components/records-page-header'
import { MeetingsTable } from '@/shared/entities/meetings/components/meetings-table/meetings-table'

// Module level keeps its identity stable, so the table's props don't churn.
function renderMeetingRowPanel(row: MeetingRow, { actions }: MeetingsExpandedRowContext) {
  return <MeetingRowPanel meeting={row} actions={actions} />
}

export function MeetingsRecordsView() {
  return (
    <RecordsPageFrame>
      <DataViewBoundary>
        <MeetingsTable
          tableView={MEETINGS_RECORDS_TABLE_VIEW}
          header={query => <RecordsPageHeader title="Meetings" query={query} />}
          renderExpandedRow={renderMeetingRowPanel}
        />
      </DataViewBoundary>
    </RecordsPageFrame>
  )
}
