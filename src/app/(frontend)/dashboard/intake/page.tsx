import { redirect } from 'next/navigation'
import { DashboardIntakeView } from '@/features/intake/ui/views/dashboard-intake-view'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function IntakePage() {
  const authState = await protectDashboardPage()

  // Layout handles unauthenticated — if we reach here, we're authenticated
  // Super-admin only — agents and other roles cannot access this page
  if (authState.status === 'authenticated' && authState.ability.cannot('manage', 'all')) {
    redirect('/dashboard')
  }

  return <DashboardIntakeView />
}
