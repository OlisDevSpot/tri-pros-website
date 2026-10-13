import { packRules } from '@casl/ability/extra'

import { DashboardOverlays } from '@/features/agent-dashboard/ui/components/dashboard-overlays'
import { AbilityProvider } from '@/shared/domains/permissions/client'
import { getRequestActor } from '@/shared/domains/permissions/server/get-request-actor'

// Mounted once for desktop and phone, so the search dialog and the Action Center have one home whichever control opens them.
export async function DashboardSessionOverlays() {
  const { session, actor } = await getRequestActor()
  if (!session) {
    return null
  }
  return (
    <AbilityProvider user={{ id: session.user.id, role: session.user.role }} rules={packRules(actor.ability.rules)}>
      <DashboardOverlays />
    </AbilityProvider>
  )
}
