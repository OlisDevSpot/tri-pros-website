import { EmptyState } from '@/shared/components/states/empty-state'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  await protectDashboardPage()
  return <EmptyState title="Coming Soon" description="Analytics is under construction." />
}
