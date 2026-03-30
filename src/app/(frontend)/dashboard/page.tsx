import { DashboardHub } from '@/features/agent-dashboard/ui/views/dashboard-hub'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const authState = await protectDashboardPage()

  if (authState.status === 'unauthenticated') {
    return <DashboardHub authState={{ status: 'unauthenticated' }} />
  }

  return (
    <DashboardHub
      authState={{
        status: 'authenticated',
        user: authState.session.user,
      }}
    />
  )
}
