import { PortfolioProjectsView } from '@/features/project-management/ui/views'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  await protectDashboardPage()
  return <PortfolioProjectsView />
}
