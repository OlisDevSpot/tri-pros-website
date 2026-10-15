import { ProposalsRoutePendingView } from '@/features/agent-dashboard/ui/components/proposals-route-pending-view'
import { DataViewPending } from '@/shared/components/data-view/ui/pending'

export default function ProposalsLoading() {
  return (
    <DataViewPending>
      <ProposalsRoutePendingView />
    </DataViewPending>
  )
}
