import { DashboardHomePendingView } from '@/features/agent-dashboard/ui/components/dashboard-home-pending-view'
import { DataViewPending } from '@/shared/components/data-view-pending'

// Inside the (home) group: a loading screen beside the dashboard layout would also stand in for every dashboard route
// that has none of its own.
export default function DashboardHomeLoading() {
  return (
    <DataViewPending>
      <DashboardHomePendingView />
    </DataViewPending>
  )
}
