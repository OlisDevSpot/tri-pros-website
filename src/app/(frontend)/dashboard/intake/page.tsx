import { redirect } from 'next/navigation'
import { DashboardIntakeView } from '@/features/intake/ui/views/dashboard-intake-view'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function IntakePage() {
  const authState = await protectDashboardPage()

  if (authState.status === 'unauthenticated') {
    redirect('/sign-in')
  }

  // Super-admin only — agents and other roles cannot access this page
  if (authState.ability.cannot('manage', 'all')) {
    redirect('/dashboard')
  }

  return <DashboardIntakeView />
}
