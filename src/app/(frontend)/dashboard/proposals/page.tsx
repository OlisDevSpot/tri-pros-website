import { PastProposalsTable } from '@/features/proposal-flow/ui/components/table'
import { RecordsPageMotionShell } from '@/shared/components/records-page-motion-shell'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'

export const dynamic = 'force-dynamic'

export default async function ProposalsPage() {
  await protectDashboardPage()
  return (
    <RecordsPageMotionShell>
      <PastProposalsTable />
    </RecordsPageMotionShell>
  )
}
