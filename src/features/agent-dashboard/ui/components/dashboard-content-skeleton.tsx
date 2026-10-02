'use client'

import { usePathname } from 'next/navigation'

import { DASHBOARD_MAIN_CLASS } from '@/features/agent-dashboard/constants/dashboard-main'
import { DASHBOARD_ROUTE_PENDING_VIEWS } from '@/features/agent-dashboard/constants/route-pending-views'
import { DashboardGenericContentSkeleton } from '@/features/agent-dashboard/ui/components/dashboard-generic-content-skeleton'
import { DataViewPending } from '@/shared/components/data-view-pending'

// Shows only on a document load while the session resolves (the layout persists across in-app navigation). On the
// routes that have one, it is the page itself with no rows, the same as the page's own loading state, so the two
// hand over without a jump.
export function DashboardContentSkeleton() {
  const pathname = usePathname()
  const PendingView = DASHBOARD_ROUTE_PENDING_VIEWS[pathname]
  if (!PendingView) {
    return <DashboardGenericContentSkeleton />
  }
  return (
    <div className="flex h-full min-w-0 flex-col" data-slot="dashboard-content-skeleton" aria-busy="true">
      <div className={DASHBOARD_MAIN_CLASS}>
        <DataViewPending>
          <PendingView />
        </DataViewPending>
      </div>
    </div>
  )
}
