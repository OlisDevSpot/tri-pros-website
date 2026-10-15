'use client'

import { PastProposalsTable } from '@/features/proposal-flow/ui/components/table'
import { DataViewBoundary } from '@/shared/components/data-view/ui/boundary'
import { RecordsPageFrame } from '@/shared/components/records-page-frame'

export function ProposalsRecordsView() {
  return (
    <RecordsPageFrame>
      <DataViewBoundary>
        <PastProposalsTable />
      </DataViewBoundary>
    </RecordsPageFrame>
  )
}
