import { CustomerPipelineView } from '@/features/customer-pipelines/ui/views'
import { DataViewPending } from '@/shared/components/data-view-pending'

export default function PipelineLoading() {
  return (
    <DataViewPending>
      <CustomerPipelineView />
    </DataViewPending>
  )
}
