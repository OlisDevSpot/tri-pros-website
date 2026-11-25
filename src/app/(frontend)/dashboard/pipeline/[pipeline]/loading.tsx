import { CustomerPipelineView } from '@/features/customer-pipelines/ui/views'
import { DataViewBoundary } from '@/shared/components/data-view/core/ui/boundary'
import { DataViewPending } from '@/shared/components/data-view/core/ui/pending'

export default function PipelineLoading() {
  return (
    <DataViewPending>
      <DataViewBoundary>
        <CustomerPipelineView />
      </DataViewBoundary>
    </DataViewPending>
  )
}
