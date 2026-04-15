import { CreateNewProposalView } from '@/features/proposal-flow/ui/views'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function NewProposalPage() {
  await protectDashboardPage()
  return <CreateNewProposalView />
}
