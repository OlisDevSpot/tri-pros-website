import { CustomerPipelineView } from '@/features/customer-pipelines/ui/views'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function PipelinePage() {
  await protectDashboardPage()
  return <CustomerPipelineView />
}
