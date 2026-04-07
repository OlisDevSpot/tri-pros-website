import { EditProjectView } from '@/features/project-management/ui/views'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function EditProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  await protectDashboardPage()
  const { projectId } = await params
  return <EditProjectView projectId={projectId} />
}
