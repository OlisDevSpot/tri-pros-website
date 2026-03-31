import { CustomerPipelineView } from '@/features/customer-pipelines/ui/views'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function PipelinesPage() {
  await protectDashboardPage()
  return <CustomerPipelineView />
}
