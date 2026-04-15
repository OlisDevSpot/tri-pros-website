import { EditProposalView } from '@/features/proposal-flow/ui/views'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function EditProposalPage({ params }: { params: Promise<{ proposalId: string }> }) {
  await protectDashboardPage()
  const { proposalId } = await params
  return <EditProposalView proposalId={proposalId} />
}
