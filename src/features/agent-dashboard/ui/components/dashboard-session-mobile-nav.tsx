import { DashboardMobileNav } from '@/features/agent-dashboard/ui/components/dashboard-mobile-nav'
import { getCachedSession } from '@/shared/domains/auth/lib/get-cached-session'

// Owns the session read for the mobile dock, which the sign-in screen does not show. The
// read is the request's cached one, and it hands the dock its user so the tabs are right in
// the first paint instead of waiting on the browser's session fetch.
export async function DashboardSessionMobileNav() {
  const session = await getCachedSession()
  if (!session) {
    return null
  }
  return <DashboardMobileNav user={{ id: session.user.id, role: session.user.role }} />
}
