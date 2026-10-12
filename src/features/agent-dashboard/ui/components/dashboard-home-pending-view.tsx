'use client'

import { DashboardView } from '@/features/agent-dashboard/ui/views/dashboard-view'
import { useSession } from '@/shared/domains/auth/client'

// The page's own composition, drawn in the pending context as its loading state. The page gets the name from the
// server; here the client session supplies it (loaded on any in-app navigation), so a return to home keeps its greeting.
export function DashboardHomePendingView() {
  const { data: session } = useSession()
  return <DashboardView name={session?.user.name ?? null} />
}
