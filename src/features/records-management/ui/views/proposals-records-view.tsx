'use client'

import { PastProposalsTable } from '@/features/proposal-flow/ui/components/table'
import { DataViewBoundary } from '@/shared/components/data-view/core/ui/boundary'
import { RecordsPageFrame } from '@/shared/components/data-view/core/ui/records-page-frame'

export function ProposalsRecordsView() {
  return (
    <RecordsPageFrame>
      <DataViewBoundary>
        <PastProposalsTable />
      </DataViewBoundary>
    </RecordsPageFrame>
  )
}
