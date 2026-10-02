'use client'

import type { EntityExpandedRowContext } from '@/shared/components/data-table/types/entity-expanded-row'
import type { MeetingRow } from '@/shared/entities/meetings/lib/columns-registry'

import { MeetingRowPanel } from '@/features/records-management/ui/components/meeting-row-panel'
import { MeetingsRecordsTable } from '@/features/records-management/ui/components/meetings-records-table'
import { DataViewBoundary } from '@/shared/components/data-view-boundary'
import { RecordsPageFrame } from '@/shared/components/records-page-frame'

// Module level keeps its identity stable, so the table's props don't churn.
function renderMeetingRowPanel(row: MeetingRow, { actions }: EntityExpandedRowContext<MeetingRow>) {
  return <MeetingRowPanel meeting={row} actions={actions} />
}

export function MeetingsRecordsView() {
  return (
    <RecordsPageFrame>
      <DataViewBoundary>
        <MeetingsRecordsTable renderExpandedRow={renderMeetingRowPanel} />
      </DataViewBoundary>
    </RecordsPageFrame>
  )
}
