import { PastProposalsView } from '@/features/proposal-flow/ui/views'
import { protectDashboardPage } from '@/shared/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function ProposalsPage() {
  await protectDashboardPage()
  return <PastProposalsView />
}
