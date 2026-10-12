import { CustomerPipelineView } from '@/features/customer-pipelines/ui/views'
import { DataViewBoundary } from '@/shared/components/data-view-boundary'
import { DataViewPending } from '@/shared/components/data-view-pending'

export default function PipelineLoading() {
  return (
    <DataViewPending>
      <DataViewBoundary>
        <CustomerPipelineView />
      </DataViewBoundary>
    </DataViewPending>
  )
}
