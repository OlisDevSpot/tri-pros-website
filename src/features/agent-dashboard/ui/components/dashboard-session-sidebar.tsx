import { packRules } from '@casl/ability/extra'

import { AppSidebar } from '@/features/agent-dashboard/ui/components/app-sidebar'
import { AbilityProvider } from '@/shared/domains/permissions/client'
import { getRequestActor } from '@/shared/domains/permissions/server/get-request-actor'

// Owns the session read for the sidebar slot, under a Suspense in the dashboard
// layout, so the layout streams before the database answers. getRequestActor
// is request-memoized: this shares one round-trip with the other slots and the
// page's protectDashboardPage().
export async function DashboardSessionSidebar() {
  const { session, actor } = await getRequestActor()
  if (!session) {
    return null
  }
  return (
    <AbilityProvider user={{ id: session.user.id, role: session.user.role }} rules={packRules(actor.ability.rules)}>
      <AppSidebar user={session.user} />
    </AbilityProvider>
  )
}
