import { CustomersRoutePendingView } from '@/features/agent-dashboard/ui/components/customers-route-pending-view'
import { DataViewPending } from '@/shared/components/data-view/ui/pending'

export default function CustomersLoading() {
  return (
    <DataViewPending>
      <CustomersRoutePendingView />
    </DataViewPending>
  )
}
