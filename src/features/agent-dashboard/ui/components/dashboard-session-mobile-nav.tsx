import { DashboardMobileNav } from '@/features/agent-dashboard/ui/components/dashboard-mobile-nav'
import { getCachedSession } from '@/shared/domains/auth/lib/get-cached-session'

// Owns the session read for the mobile bottom nav, which the sign-in screen
// does not show.
export async function DashboardSessionMobileNav() {
  const session = await getCachedSession()
  if (!session) {
    return null
  }
  return <DashboardMobileNav />
}
