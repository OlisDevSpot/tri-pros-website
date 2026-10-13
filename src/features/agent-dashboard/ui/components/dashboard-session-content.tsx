import { packRules } from '@casl/ability/extra'

import { DashboardSignIn } from '@/features/agent-dashboard/ui/components/dashboard-sign-in'
import { AbilityProvider } from '@/shared/domains/permissions/client'
import { getRequestActor } from '@/shared/domains/permissions/server/get-request-actor'
import { PushSubscriptionBanner } from '@/shared/domains/pwa/ui/push-subscription-banner'

// Owns the session read for the page slot. A session cookie that no longer maps
// to a session (expired, revoked) lands here as null and gets the sign-in
// screen, the same screen as having no cookie at all. It also seeds the page's
// permissions from this session, so gated UI is in the first paint instead of
// waiting on the browser's session fetch.
export async function DashboardSessionContent({ children }: { children: React.ReactNode }) {
  const { session, actor } = await getRequestActor()
  if (!session) {
    return <DashboardSignIn />
  }
  return (
    <AbilityProvider user={{ id: session.user.id, role: session.user.role }} rules={packRules(actor.ability.rules)}>
      <PushSubscriptionBanner />
      {children}
    </AbilityProvider>
  )
}
