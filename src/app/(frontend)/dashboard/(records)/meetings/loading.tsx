import { MeetingsRecordsView } from '@/features/records-management/ui/views/meetings-records-view'
import { DataViewPending } from '@/shared/components/data-view/core/ui/pending'

export default function MeetingsLoading() {
  return (
    <DataViewPending>
      <MeetingsRecordsView />
    </DataViewPending>
  )
}
