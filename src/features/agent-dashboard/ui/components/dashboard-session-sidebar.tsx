import { AppSidebar } from '@/features/agent-dashboard/ui/components/app-sidebar'
import { getCachedSession } from '@/shared/domains/auth/lib/get-cached-session'

// Owns the session read for the sidebar slot, under a Suspense in the dashboard
// layout, so the layout streams before the database answers. getCachedSession
// is request-memoized: this shares one round-trip with the other slots and the
// page's protectDashboardPage().
export async function DashboardSessionSidebar() {
  const session = await getCachedSession()
  if (!session) {
    return null
  }
  return <AppSidebar user={session.user} />
}
