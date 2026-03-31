import { CreateProjectView } from '@/features/showroom/ui/views'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function NewProjectPage() {
  await protectDashboardPage()
  return <CreateProjectView />
}
