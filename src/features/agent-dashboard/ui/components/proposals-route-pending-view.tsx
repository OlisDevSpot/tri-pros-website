'use client'

import { PastProposalsTable } from '@/features/proposal-flow/ui/components/table'
import { RecordsPageFrame } from '@/shared/components/records-page-frame'

// The page's own composition, drawn in the pending context as the layout's loading state.
export function ProposalsRoutePendingView() {
  return (
    <RecordsPageFrame>
      <PastProposalsTable />
    </RecordsPageFrame>
  )
}
