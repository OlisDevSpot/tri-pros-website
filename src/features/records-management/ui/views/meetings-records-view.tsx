'use client'

import { MEETINGS_RECORDS_TABLE_VIEW } from '@/features/records-management/constants/meetings-records-table-view'
import { RecordsPageHeader } from '@/shared/components/records-page-header'
import { RecordsPageMotionShell } from '@/shared/components/records-page-motion-shell'
import { MeetingsTable } from '@/shared/entities/meetings/components/meetings-table/meetings-table'

export function MeetingsRecordsView() {
  return (
    <RecordsPageMotionShell>
      <MeetingsTable
        tableView={MEETINGS_RECORDS_TABLE_VIEW}
        header={pagination => <RecordsPageHeader title="Meetings" pagination={pagination} />}
      />
    </RecordsPageMotionShell>
  )
}
