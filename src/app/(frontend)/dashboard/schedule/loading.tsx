import { ScheduleView } from '@/features/schedule-management/ui/views/schedule-view'
import { DataViewPending } from '@/shared/components/data-view-pending'

export default function ScheduleLoading() {
  return (
    <DataViewPending>
      <ScheduleView />
    </DataViewPending>
  )
}
