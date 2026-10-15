import { ScheduleView } from '@/features/schedule-management/ui/views/schedule-view'
import { DataViewPending } from '@/shared/components/data-view/ui/pending'

export default function ScheduleLoading() {
  return (
    <DataViewPending>
      <ScheduleView />
    </DataViewPending>
  )
}
