'use client'

import type { MeetingsExpandedRowContext } from '@/shared/entities/meetings/components/meetings-table/use-meetings-table'
import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { MEETINGS_RECORDS_TABLE_VIEW } from '@/features/records-management/constants/meetings-records-table-view'
import { MeetingRowPanel } from '@/features/records-management/ui/components/meeting-row-panel'
import { RecordsPageHeader } from '@/shared/components/records-page-header'
import { RecordsPageMotionShell } from '@/shared/components/records-page-motion-shell'
import { MeetingsTable } from '@/shared/entities/meetings/components/meetings-table/meetings-table'

// Module level keeps its identity stable, so the table's props don't churn.
function renderMeetingRowPanel(row: MeetingRow, { actions }: MeetingsExpandedRowContext) {
  return <MeetingRowPanel meeting={row} actions={actions} />
}

export function MeetingsRecordsView() {
  return (
    <RecordsPageMotionShell>
      <MeetingsTable
        tableView={MEETINGS_RECORDS_TABLE_VIEW}
        header={query => <RecordsPageHeader title="Meetings" query={query} />}
        renderExpandedRow={renderMeetingRowPanel}
      />
    </RecordsPageMotionShell>
  )
}
