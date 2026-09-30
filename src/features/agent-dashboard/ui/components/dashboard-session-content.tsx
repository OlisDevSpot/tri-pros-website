import { DashboardSignIn } from '@/features/agent-dashboard/ui/components/dashboard-sign-in'
import { PushSubscriptionBanner } from '@/shared/components/push-subscription-banner'
import { getCachedSession } from '@/shared/domains/auth/lib/get-cached-session'

// Owns the session read for the page slot. A session cookie that no longer maps
// to a session (expired, revoked) lands here as null and gets the sign-in
// screen, the same screen as having no cookie at all.
export async function DashboardSessionContent({ children }: { children: React.ReactNode }) {
  const session = await getCachedSession()
  if (!session) {
    return <DashboardSignIn />
  }
  return (
    <>
      <PushSubscriptionBanner />
      {children}
    </>
  )
}
