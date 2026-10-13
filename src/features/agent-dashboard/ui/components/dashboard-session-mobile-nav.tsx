import { packRules } from '@casl/ability/extra'

import { DashboardMobileNav } from '@/features/agent-dashboard/ui/components/dashboard-mobile-nav'
import { AbilityProvider } from '@/shared/domains/permissions/client'
import { getRequestActor } from '@/shared/domains/permissions/server/get-request-actor'

// Owns the session read for the mobile dock, which the sign-in screen does not show. The
// read is the request's cached one, and it feeds the dock's permissions, so the tabs are right in
// the first paint instead of waiting on the browser's session fetch.
export async function DashboardSessionMobileNav() {
  const { session, actor } = await getRequestActor()
  if (!session) {
    return null
  }
  return (
    <AbilityProvider user={{ id: session.user.id, role: session.user.role }} rules={packRules(actor.ability.rules)}>
      <DashboardMobileNav />
    </AbilityProvider>
  )
}
