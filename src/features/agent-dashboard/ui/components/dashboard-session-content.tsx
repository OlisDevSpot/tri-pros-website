import { DashboardSignIn } from '@/features/agent-dashboard/ui/components/dashboard-sign-in'
import { ServerAbilityProvider } from '@/shared/components/providers/server-ability-provider'
import { PushSubscriptionBanner } from '@/shared/components/push-subscription-banner'
import { getCachedSession } from '@/shared/domains/auth/lib/get-cached-session'

// Owns the session read for the page slot. A session cookie that no longer maps
// to a session (expired, revoked) lands here as null and gets the sign-in
// screen, the same screen as having no cookie at all. It also seeds the page's
// permissions from this session, so gated UI is in the first paint instead of
// waiting on the browser's session fetch.
export async function DashboardSessionContent({ children }: { children: React.ReactNode }) {
  const session = await getCachedSession()
  if (!session) {
    return <DashboardSignIn />
  }
  return (
    <ServerAbilityProvider user={{ id: session.user.id, role: session.user.role }}>
      <PushSubscriptionBanner />
      {children}
    </ServerAbilityProvider>
  )
}
