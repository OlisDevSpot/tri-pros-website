import { PortfolioProjectsView } from '@/features/showroom/ui/views'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function ShowroomPage() {
  await protectDashboardPage()
  return <PortfolioProjectsView />
}
