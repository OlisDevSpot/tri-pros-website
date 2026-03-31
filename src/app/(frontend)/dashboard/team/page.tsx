import { EmptyState } from '@/shared/components/states/empty-state'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  await protectDashboardPage()
  return <EmptyState title="Coming Soon" description="Team management is under construction." />
}
