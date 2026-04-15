import { CreateProjectView } from '@/features/project-management/ui/views'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function NewProjectPage() {
  await protectDashboardPage()
  return <CreateProjectView />
}
