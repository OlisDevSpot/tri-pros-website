import { PortfolioProjectsTable } from '@/features/project-management/ui/components/table'
import { RecordsPageMotionShell } from '@/shared/components/records-page-motion-shell'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  await protectDashboardPage()
  return (
    <RecordsPageMotionShell>
      <PortfolioProjectsTable />
    </RecordsPageMotionShell>
  )
}
