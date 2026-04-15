import { EmptyState } from '@/shared/components/states/empty-state'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function DashboardOverviewPage() {
  await protectDashboardPage()
  return <EmptyState title="Coming Soon" description="The dashboard overview is under construction." />
}
