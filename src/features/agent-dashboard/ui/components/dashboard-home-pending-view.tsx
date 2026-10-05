'use client'

import { DashboardView } from '@/features/agent-dashboard/ui/views/dashboard-view'

// The page's own composition, drawn in the pending context as the layout's loading state.
export function DashboardHomePendingView() {
  return <DashboardView name={null} />
}
