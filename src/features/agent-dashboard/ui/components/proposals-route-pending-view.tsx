'use client'

import { PastProposalsTable } from '@/features/proposal-flow/ui/components/table'
import { RecordsPageMotionShell } from '@/shared/components/records-page-motion-shell'

// The page's own composition, drawn in the pending context as the layout's loading state.
export function ProposalsRoutePendingView() {
  return (
    <RecordsPageMotionShell>
      <PastProposalsTable />
    </RecordsPageMotionShell>
  )
}
