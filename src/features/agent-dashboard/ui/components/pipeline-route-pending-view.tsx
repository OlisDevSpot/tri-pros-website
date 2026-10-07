'use client'

import { CustomerPipelineView } from '@/features/customer-pipelines/ui/views'
import { PipelineProvider } from '@/shared/domains/pipelines/hooks/pipeline-context'

// The layout's loading state renders above the [pipeline] segment layout, so the provider the view reads comes from here.
export function PipelineRoutePendingView() {
  return (
    <PipelineProvider>
      <CustomerPipelineView />
    </PipelineProvider>
  )
}
